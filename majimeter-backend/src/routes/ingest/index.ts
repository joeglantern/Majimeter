import type { FastifyInstance } from 'fastify'
import { checkAnomalies } from '../../services/anomalyService'
import { createIfNew } from '../../services/alertService'
import { Errors } from '../../utils/errors'
import { ok } from '../../utils/response'

const ingestSchema = {
  body: {
    type: 'object',
    required: ['sensor_id'],
    additionalProperties: true, // IoT devices may send extra fields
    properties: {
      sensor_id:    { type: 'string' },
      timestamp:    { type: 'string' },
      flow_rate:    { type: 'number' },
      pressure:     { type: 'number' },
      water_level:  { type: 'number' },
      temperature:  { type: 'number' },
      battery_level:{ type: 'number' },
    },
  },
} as const

interface IngestBody {
  sensor_id: string
  timestamp?: string
  flow_rate?: number
  pressure?: number
  water_level?: number
  temperature?: number
  battery_level?: number
}

/**
 * HTTP sensor ingestion endpoint — for IoT devices that use HTTP instead of MQTT,
 * or for testing without an MQTT broker.
 *
 * Authentication: X-Device-Key header must match a sensor_id in water_points.
 */
export default async function ingestRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: IngestBody }>(
    '/sensor',
    { schema: ingestSchema },
    async (req, reply) => {
      const deviceKey = req.headers['x-device-key'] as string | undefined
      if (!deviceKey) throw Errors.unauthorized('Missing X-Device-Key header')

      const { db, redis } = fastify

      const [waterPoint] = await db<{ id: string }[]>`
        SELECT id FROM water_points WHERE sensor_id = ${deviceKey}
      `
      if (!waterPoint) throw Errors.unauthorized('Unknown device key')

      const { sensor_id, timestamp, ...values } = req.body
      const readingTime = timestamp ? new Date(timestamp) : new Date()

      // Persist reading
      await db`
        INSERT INTO sensor_readings
          (time, sensor_id, water_point_id, flow_rate, pressure, water_level, temperature, battery_level)
        VALUES (
          ${readingTime},
          ${sensor_id},
          ${waterPoint.id},
          ${values.flow_rate    ?? null},
          ${values.pressure     ?? null},
          ${values.water_level  ?? null},
          ${values.temperature  ?? null},
          ${values.battery_level ?? null}
        )
      `

      // Anomaly detection + alert creation
      const anomalies = checkAnomalies(values)
      await Promise.all(
        anomalies.map((a) => createIfNew(fastify, { waterPointId: waterPoint.id, ...a })),
      )

      // Publish to Redis for Socket.IO /sensors namespace (step 14)
      await redis.publish(
        `sensor:${waterPoint.id}`,
        JSON.stringify({
          waterPointId:  waterPoint.id,
          flowRate:      values.flow_rate     ?? null,
          pressure:      values.pressure      ?? null,
          waterLevel:    values.water_level   ?? null,
          temperature:   values.temperature   ?? null,
          batteryLevel:  values.battery_level ?? null,
          time:          readingTime.toISOString(),
        }),
      )

      return reply.status(201).send(ok(null, 'Reading recorded'))
    },
  )
}
