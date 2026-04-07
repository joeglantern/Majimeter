import type { FastifyInstance } from 'fastify'
import { checkAnomalies } from '../services/anomalyService'
import { createIfNew } from '../services/alertService'

interface MqttSensorPayload {
  sensor_id: string
  timestamp?: string
  flow_rate?: number
  pressure?: number
  water_level?: number
  temperature?: number
  battery_level?: number
}

/**
 * Handles an incoming MQTT message on the sensors/# topic.
 *
 * Flow:
 *  1. Parse + validate payload
 *  2. Resolve water_point_id from sensor_id
 *  3. Insert sensor reading into DB
 *  4. Run anomaly checks → create alerts if triggered
 *  5. Publish reading to Redis for Socket.IO /sensors namespace (step 14)
 */
export async function handleSensorMessage(
  fastify: FastifyInstance,
  topic: string,
  rawPayload: Buffer,
): Promise<void> {
  // Only handle topics matching sensors/{sensorId}/data
  const parts = topic.split('/')
  if (parts.length !== 3 || parts[0] !== 'sensors' || parts[2] !== 'data') return

  const sensorId = parts[1]

  let data: MqttSensorPayload
  try {
    data = JSON.parse(rawPayload.toString()) as MqttSensorPayload
  } catch {
    fastify.log.warn({ topic }, 'Malformed MQTT payload — skipping')
    return
  }

  const { db, redis } = fastify

  // Resolve water point
  const [waterPoint] = await db<{ id: string }[]>`
    SELECT id FROM water_points WHERE sensor_id = ${sensorId}
  `
  if (!waterPoint) {
    fastify.log.warn({ sensorId }, 'No water point found for sensor — skipping')
    return
  }

  const readingTime = data.timestamp ? new Date(data.timestamp) : new Date()

  // Persist reading
  await db`
    INSERT INTO sensor_readings
      (time, sensor_id, water_point_id, flow_rate, pressure, water_level, temperature, battery_level)
    VALUES (
      ${readingTime},
      ${sensorId},
      ${waterPoint.id},
      ${data.flow_rate   ?? null},
      ${data.pressure    ?? null},
      ${data.water_level ?? null},
      ${data.temperature ?? null},
      ${data.battery_level ?? null}
    )
  `

  // Anomaly detection
  const anomalies = checkAnomalies({
    flow_rate:   data.flow_rate,
    pressure:    data.pressure,
    water_level: data.water_level,
  })

  for (const anomaly of anomalies) {
    await createIfNew(fastify, { waterPointId: waterPoint.id, ...anomaly })
  }

  // Publish normalised reading to Redis for Socket.IO /sensors namespace (step 14)
  await redis.publish(
    `sensor:${waterPoint.id}`,
    JSON.stringify({
      waterPointId:  waterPoint.id,
      flowRate:      data.flow_rate     ?? null,
      pressure:      data.pressure      ?? null,
      waterLevel:    data.water_level   ?? null,
      temperature:   data.temperature   ?? null,
      batteryLevel:  data.battery_level ?? null,
      time:          readingTime.toISOString(),
    }),
  )
}
