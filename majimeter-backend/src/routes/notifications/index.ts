import type { FastifyInstance } from 'fastify'
import { ok, paginated } from '../../utils/response'
import { Errors } from '../../utils/errors'

export default async function notificationRoutes(fastify: FastifyInstance) {
  const { db } = fastify

  // GET /api/v1/notifications
  fastify.get<{ Querystring: { cursor?: string; limit?: number } }>(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            cursor: { type: 'string' },
            limit:  { type: 'number', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (req, reply) => {
      const { cursor, limit = 20 } = req.query
      const cursorFilter = cursor ? db`AND sent_at < ${new Date(cursor)}` : db``

      const data = await db`
        SELECT * FROM notifications
        WHERE  user_id = ${req.user.sub}
        ${cursorFilter}
        ORDER  BY sent_at DESC
        LIMIT  ${limit}
      `

      const nextCursor = data.length === limit
        ? (data[data.length - 1] as { sent_at: Date }).sent_at.toISOString()
        : null

      return reply.send(paginated(data, { cursor: nextCursor, limit }))
    },
  )

  // PATCH /api/v1/notifications/:id/read
  fastify.patch<{ Params: { id: string } }>(
    '/:id/read',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const [notif] = await db`
        SELECT id, user_id FROM notifications WHERE id = ${req.params.id}
      `
      if (!notif) throw Errors.notFound('Notification')
      if (notif.user_id !== req.user.sub) throw Errors.forbidden()

      await db`UPDATE notifications SET read = true WHERE id = ${req.params.id}`
      return reply.send(ok(null, 'Marked as read'))
    },
  )

  // PATCH /api/v1/notifications/read-all
  fastify.patch(
    '/read-all',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      await db`
        UPDATE notifications SET read = true
        WHERE  user_id = ${req.user.sub} AND read = false
      `
      return reply.send(ok(null, 'All notifications marked as read'))
    },
  )
}
