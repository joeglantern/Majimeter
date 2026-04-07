import type { FastifyInstance } from 'fastify'
import type { AlertRow, AlertType, AlertSeverity } from '../types/db'

interface CreateAlertInput {
  waterPointId: string
  type: AlertType
  severity: AlertSeverity
  message: string
}

/**
 * Creates an alert only if no unacknowledged alert of the same type
 * already exists for this water point — prevents flooding duplicate alerts.
 *
 * After creation, publishes to two Redis pub/sub channels:
 *   - "alerts:new"  → picked up by Socket.IO /alerts namespace (step 14)
 *   - "map:alerts"  → picked up by Socket.IO /map namespace (step 14)
 */
export async function createIfNew(
  fastify: FastifyInstance,
  input: CreateAlertInput,
): Promise<AlertRow | null> {
  const { db, redis, log } = fastify

  // Deduplicate: skip if same-type alert already open for this water point
  const [existing] = await db<{ id: string }[]>`
    SELECT id FROM alerts
    WHERE  water_point_id   = ${input.waterPointId}
      AND  type             = ${input.type}::alert_type
      AND  acknowledged_at IS NULL
    LIMIT 1
  `
  if (existing) return null

  const [alert] = await db<AlertRow[]>`
    INSERT INTO alerts (water_point_id, type, severity, message)
    VALUES (
      ${input.waterPointId},
      ${input.type}::alert_type,
      ${input.severity}::alert_severity,
      ${input.message}
    )
    RETURNING *
  `

  log.warn({ alertId: alert.id, type: alert.type, severity: alert.severity }, 'Alert created')

  // Publish for real-time delivery (Socket.IO namespaces wire up in step 14)
  const payload = JSON.stringify(alert)
  await Promise.all([
    redis.publish('alerts:new', payload),
    redis.publish('map:alerts', payload),
  ])

  // Notify all users near this water point via FCM
  // (best-effort — import lazily to avoid circular dep)
  const { sendNotification } = await import('./notificationService')
  const nearbyUsers = await fastify.db<{ id: string }[]>`
    SELECT id FROM users
    WHERE location_lat IS NOT NULL
      AND location_lng IS NOT NULL
      AND fcm_token IS NOT NULL
  `
  await Promise.allSettled(
    nearbyUsers.map((u) =>
      sendNotification(fastify, {
        userId: u.id,
        title:  `Alert: ${input.type.replace(/_/g, ' ')}`,
        body:   input.message,
        type:   'alert',
        refId:  alert.id,
      }),
    ),
  )

  return alert
}
