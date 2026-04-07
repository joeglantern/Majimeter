import type { FastifyInstance } from 'fastify'
import type { NotificationRow, NotificationType } from '../types/db'

interface SendInput {
  userId: string
  title: string
  body: string
  type: NotificationType
  refId?: string
}

/**
 * Persists a notification row and attempts FCM push delivery.
 * FCM is best-effort — a failed push does not throw.
 */
export async function sendNotification(
  fastify: FastifyInstance,
  input: SendInput,
): Promise<NotificationRow> {
  const [notification] = await fastify.db<NotificationRow[]>`
    INSERT INTO notifications (user_id, title, body, type, ref_id)
    VALUES (
      ${input.userId},
      ${input.title},
      ${input.body},
      ${input.type}::notification_type,
      ${input.refId ?? null}
    )
    RETURNING *
  `

  // FCM push — fire and forget, failure is logged not thrown
  sendFcmPush(fastify, input.userId, input.title, input.body).catch((err) =>
    fastify.log.warn({ err, userId: input.userId }, 'FCM push failed'),
  )

  return notification
}

/**
 * Sends a push notification via Firebase Admin SDK.
 * Requires FCM_PROJECT_ID, FCM_PRIVATE_KEY, FCM_CLIENT_EMAIL in env.
 * Silently skips if env vars are not set (dev / pre-FCM setup).
 */
async function sendFcmPush(
  fastify: FastifyInstance,
  userId: string,
  title: string,
  body: string,
): Promise<void> {
  if (!process.env.FCM_PROJECT_ID) return // FCM not configured yet

  // Fetch user's FCM token
  const [user] = await fastify.db<{ fcm_token: string | null }[]>`
    SELECT fcm_token FROM users WHERE id = ${userId}
  `
  if (!user?.fcm_token) return

  // Lazy-load firebase-admin to avoid crashing when env vars are absent
  const admin = await import('firebase-admin').then((m) => m.default)

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FCM_PROJECT_ID,
        privateKey:  process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FCM_CLIENT_EMAIL,
      }),
    })
  }

  await admin.messaging().send({
    token:        user.fcm_token,
    notification: { title, body },
    android:      { priority: 'high' },
    apns:         { payload: { aps: { sound: 'default' } } },
  })
}
