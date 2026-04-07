import type { FastifyInstance } from 'fastify'
import { ok } from '../../utils/response'
import { Errors } from '../../utils/errors'

export default async function analyticsRoutes(fastify: FastifyInstance) {
  const { db } = fastify

  // GET /api/v1/analytics/usage?water_point_id=&period=daily|weekly|monthly
  fastify.get<{
    Querystring: { water_point_id: string; period: 'daily' | 'weekly' | 'monthly' }
  }>(
    '/usage',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['water_point_id', 'period'],
          additionalProperties: false,
          properties: {
            water_point_id: { type: 'string' },
            period: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (req, reply) => {
      const { water_point_id, period } = req.query

      // Map period to date_trunc unit and look-back window
      const truncUnit = period === 'monthly' ? 'month' : period === 'weekly' ? 'week' : 'day'
      const lookback  = period === 'monthly' ? '12 months' : period === 'weekly' ? '12 weeks' : '30 days'

      const data = await db`
        SELECT
          date_trunc(${truncUnit}, time)  AS period,
          AVG(flow_rate::float)           AS avg_flow_rate,
          AVG(pressure::float)            AS avg_pressure,
          AVG(water_level::float)         AS avg_water_level,
          MIN(water_level::float)         AS min_water_level,
          MAX(pressure::float)            AS max_pressure,
          COUNT(*)::int                   AS reading_count
        FROM  sensor_readings
        WHERE water_point_id = ${water_point_id}
          AND time >= NOW() - ${lookback}::interval
        GROUP BY period
        ORDER BY period
      `

      return reply.send(ok(data))
    },
  )

  // GET /api/v1/analytics/summary
  fastify.get(
    '/summary',
    { preHandler: [fastify.authenticate] },
    async (_req, reply) => {
      const [summary] = await db`
        SELECT
          (SELECT COUNT(*) FROM water_points WHERE status = 'active')::int        AS active_water_points,
          (SELECT COUNT(*) FROM water_points)::int                                AS total_water_points,
          (SELECT COUNT(*) FROM reports     WHERE status = 'open')::int           AS open_reports,
          (SELECT COUNT(*) FROM alerts      WHERE acknowledged_at IS NULL)::int   AS active_alerts,
          (SELECT COUNT(*) FROM alerts      WHERE severity = 'critical'
                                              AND acknowledged_at IS NULL)::int   AS critical_alerts,
          (SELECT COUNT(*) FROM sensor_readings
           WHERE time >= NOW() - INTERVAL '24 hours')::int                        AS readings_today
      `
      return reply.send(ok(summary))
    },
  )

  // GET /api/v1/analytics/anomalies
  fastify.get<{ Querystring: { limit?: number } }>(
    '/anomalies',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { limit: { type: 'number', minimum: 1, maximum: 100, default: 20 } },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (req, reply) => {
      const limit = req.query.limit ?? 20

      const data = await db`
        SELECT
          a.*,
          wp.name  AS water_point_name,
          wp.location_lat,
          wp.location_lng
        FROM  alerts a
        JOIN  water_points wp ON wp.id = a.water_point_id
        WHERE a.triggered_at >= NOW() - INTERVAL '7 days'
        ORDER BY a.triggered_at DESC
        LIMIT ${limit}
      `

      return reply.send(ok(data))
    },
  )
}
