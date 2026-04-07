import type { FastifyInstance } from 'fastify'
import type { AlertSeverity, AlertType } from '../../types/db'
import { ok, paginated } from '../../utils/response'
import { Errors } from '../../utils/errors'

export default async function alertRoutes(fastify: FastifyInstance) {
  const { db } = fastify

  // GET /api/v1/alerts
  fastify.get<{
    Querystring: {
      severity?: AlertSeverity
      type?: AlertType
      water_point_id?: string
      acknowledged?: string   // 'true' | 'false'
      cursor?: string
      limit?: number
    }
  }>(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            severity:       { type: 'string', enum: ['info', 'warning', 'critical'] },
            type:           { type: 'string', enum: ['low_level', 'high_pressure', 'low_pressure', 'no_flow', 'leak_detected'] },
            water_point_id: { type: 'string' },
            acknowledged:   { type: 'string', enum: ['true', 'false'] },
            cursor:         { type: 'string' },
            limit:          { type: 'number', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (req, reply) => {
      const { severity, type, water_point_id, acknowledged, cursor, limit = 20 } = req.query

      const severityFilter      = severity        ? db`AND severity        = ${severity}::alert_severity` : db``
      const typeFilter          = type            ? db`AND type            = ${type}::alert_type`         : db``
      const waterPointFilter    = water_point_id  ? db`AND water_point_id  = ${water_point_id}`           : db``
      const acknowledgedFilter  = acknowledged === 'true'
        ? db`AND acknowledged_at IS NOT NULL`
        : acknowledged === 'false'
          ? db`AND acknowledged_at IS NULL`
          : db``
      const cursorFilter        = cursor          ? db`AND triggered_at < ${new Date(cursor)}`            : db``

      const data = await db`
        SELECT * FROM alerts
        WHERE TRUE
        ${severityFilter}
        ${typeFilter}
        ${waterPointFilter}
        ${acknowledgedFilter}
        ${cursorFilter}
        ORDER BY triggered_at DESC
        LIMIT  ${limit}
      `

      const nextCursor = data.length === limit
        ? (data[data.length - 1] as { triggered_at: Date }).triggered_at.toISOString()
        : null

      return reply.send(paginated(data, { cursor: nextCursor, limit }))
    },
  )

  // GET /api/v1/alerts/:id
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const [alert] = await db`SELECT * FROM alerts WHERE id = ${req.params.id}`
      if (!alert) throw Errors.notFound('Alert')
      return reply.send(ok(alert))
    },
  )

  // PATCH /api/v1/alerts/:id/acknowledge  (technician / admin only)
  fastify.patch<{ Params: { id: string } }>(
    '/:id/acknowledge',
    { preHandler: [fastify.authorize('admin', 'technician')] },
    async (req, reply) => {
      const [alert] = await db`SELECT id, acknowledged_at FROM alerts WHERE id = ${req.params.id}`
      if (!alert) throw Errors.notFound('Alert')
      if (alert.acknowledged_at) throw Errors.badRequest('Alert already acknowledged')

      const [updated] = await db`
        UPDATE alerts
        SET    acknowledged_at = NOW(),
               acknowledged_by = ${req.user.sub}
        WHERE  id = ${req.params.id}
        RETURNING *
      `

      // Notify Socket.IO /alerts namespace (step 14)
      await fastify.redis.publish(
        'alerts:acknowledged',
        JSON.stringify({
          alertId:         updated.id,
          acknowledgedBy:  req.user.sub,
          acknowledgedAt:  updated.acknowledged_at,
        }),
      )

      return reply.send(ok(updated, 'Alert acknowledged'))
    },
  )
}
