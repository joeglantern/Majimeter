import type { Sql } from 'postgres'
import type { WaterPointRow, WaterPointStatus, WaterPointType } from '../types/db'
import { Errors } from '../utils/errors'

// Rough conversion: 1 degree latitude ≈ 111 km
const KM_PER_DEGREE = 111

export class WaterPointService {
  constructor(private readonly db: Sql) {}

  async list(filters: {
    lat?: number
    lng?: number
    radius?: number // km
    status?: WaterPointStatus
  }) {
    const { lat, lng, radius, status } = filters

    const geoFilter =
      lat != null && lng != null && radius != null
        ? this.db`
            AND location_lat BETWEEN ${lat - radius / KM_PER_DEGREE}
                                 AND ${lat + radius / KM_PER_DEGREE}
            AND location_lng BETWEEN ${lng - radius / KM_PER_DEGREE}
                                 AND ${lng + radius / KM_PER_DEGREE}
          `
        : this.db``

    const statusFilter = status
      ? this.db`AND status = ${status}::water_point_status`
      : this.db``

    return this.db<WaterPointRow[]>`
      SELECT id, name, type, location_lat, location_lng, address, status, sensor_id, created_at, updated_at
      FROM   water_points
      WHERE  TRUE
      ${geoFilter}
      ${statusFilter}
      ORDER  BY name
      LIMIT  100
    `
  }

  async findById(id: string) {
    const rows = await this.db<
      (WaterPointRow & {
        latest_reading: {
          flow_rate: string | null
          pressure: string | null
          water_level: string | null
          battery_level: string | null
          time: string
        } | null
      })[]
    >`
      SELECT
        wp.*,
        row_to_json(sr.*) AS latest_reading
      FROM water_points wp
      LEFT JOIN LATERAL (
        SELECT flow_rate, pressure, water_level, battery_level, time
        FROM   sensor_readings
        WHERE  water_point_id = wp.id
        ORDER  BY time DESC
        LIMIT  1
      ) sr ON true
      WHERE wp.id = ${id}
    `

    if (!rows[0]) throw Errors.notFound('Water point')
    return rows[0]
  }

  async create(data: {
    name: string
    type: WaterPointType
    location_lat: number
    location_lng: number
    address?: string
    status?: WaterPointStatus
    sensor_id?: string
  }) {
    const [row] = await this.db<WaterPointRow[]>`
      INSERT INTO water_points (name, type, location_lat, location_lng, address, status, sensor_id)
      VALUES (
        ${data.name},
        ${data.type}::water_point_type,
        ${data.location_lat},
        ${data.location_lng},
        ${data.address ?? null},
        ${(data.status ?? 'active')}::water_point_status,
        ${data.sensor_id ?? null}
      )
      RETURNING *
    `
    return row
  }

  async update(
    id: string,
    data: Partial<{
      name: string
      type: WaterPointType
      location_lat: number
      location_lng: number
      address: string
      status: WaterPointStatus
      sensor_id: string
    }>,
  ) {
    // Verify it exists
    await this.findById(id)

    const fields = Object.entries(data).filter(([, v]) => v !== undefined)
    if (fields.length === 0) throw Errors.badRequest('No fields to update')

    // Build SET clause dynamically — safe because keys come from a known object shape
    const setClauses = fields.map(([key, value]) => {
      if (key === 'type') return this.db`type = ${value}::water_point_type`
      if (key === 'status') return this.db`status = ${value}::water_point_status`
      return this.db`${this.db(key)} = ${value}`
    })

    // Join with commas using reduce
    const setClause = setClauses.reduce((acc, clause) => this.db`${acc}, ${clause}`)

    const [updated] = await this.db<WaterPointRow[]>`
      UPDATE water_points
      SET    ${setClause}
      WHERE  id = ${id}
      RETURNING *
    `
    return updated
  }

  async getLatestReading(waterPointId: string) {
    // Verify water point exists
    await this.findById(waterPointId)

    const [reading] = await this.db`
      SELECT flow_rate, pressure, water_level, temperature, battery_level, time
      FROM   sensor_readings
      WHERE  water_point_id = ${waterPointId}
      ORDER  BY time DESC
      LIMIT  1
    `
    return reading ?? null
  }

  async getSensorHistory(
    waterPointId: string,
    from: Date,
    to: Date,
    interval: 'raw' | '1h' | '1d',
  ) {
    await this.findById(waterPointId)

    if (interval === 'raw') {
      return this.db`
        SELECT time, flow_rate, pressure, water_level, temperature, battery_level
        FROM   sensor_readings
        WHERE  water_point_id = ${waterPointId}
          AND  time >= ${from}
          AND  time <= ${to}
        ORDER  BY time DESC
        LIMIT  500
      `
    }

    const truncUnit = interval === '1d' ? 'day' : 'hour'

    return this.db`
      SELECT
        date_trunc(${truncUnit}, time)  AS bucket,
        AVG(flow_rate::float)           AS avg_flow_rate,
        AVG(pressure::float)            AS avg_pressure,
        AVG(water_level::float)         AS avg_water_level,
        MIN(water_level::float)         AS min_water_level,
        MAX(pressure::float)            AS max_pressure,
        COUNT(*)::int                   AS reading_count
      FROM  sensor_readings
      WHERE water_point_id = ${waterPointId}
        AND time >= ${from}
        AND time <= ${to}
      GROUP BY bucket
      ORDER BY bucket
    `
  }

  async getAlerts(waterPointId: string, cursor: Date | null, limit: number) {
    await this.findById(waterPointId)

    const cursorFilter = cursor
      ? this.db`AND triggered_at < ${cursor}`
      : this.db``

    return this.db`
      SELECT *
      FROM   alerts
      WHERE  water_point_id = ${waterPointId}
      ${cursorFilter}
      ORDER  BY triggered_at DESC
      LIMIT  ${limit}
    `
  }

  async getReports(waterPointId: string, cursor: Date | null, limit: number) {
    await this.findById(waterPointId)

    const cursorFilter = cursor
      ? this.db`AND created_at < ${cursor}`
      : this.db``

    return this.db`
      SELECT id, user_id, type, title, status, upvotes, location_lat, location_lng, created_at
      FROM   reports
      WHERE  water_point_id = ${waterPointId}
      ${cursorFilter}
      ORDER  BY created_at DESC
      LIMIT  ${limit}
    `
  }
}
