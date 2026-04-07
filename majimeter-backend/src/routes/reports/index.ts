import type { FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import { ReportService } from '../../services/reportService'
import { listReportsSchema, updateReportStatusSchema } from '../../schemas/reports'
import type { ReportStatus, ReportType } from '../../types/db'
import { ok, paginated } from '../../utils/response'
import { Errors } from '../../utils/errors'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024  // 5 MB
const MAX_IMAGES     = 5

export default async function reportRoutes(fastify: FastifyInstance) {
  // Multipart support scoped to this plugin only
  await fastify.register(multipart, {
    limits: { fileSize: MAX_IMAGE_SIZE, files: MAX_IMAGES },
  })

  const svc = new ReportService(fastify.db, fastify.supabase)

  // GET /api/v1/reports
  fastify.get<{
    Querystring: {
      status?: ReportStatus; type?: ReportType
      lat?: number; lng?: number; radius?: number
      cursor?: string; limit?: number
    }
  }>(
    '/',
    { schema: listReportsSchema, preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { status, type, lat, lng, radius, cursor, limit = 20 } = req.query
      const data = await svc.list({
        status, type, lat, lng, radius, limit,
        cursor: cursor ? new Date(cursor) : null,
      })
      const nextCursor = data.length === limit
        ? (data[data.length - 1] as { created_at: Date }).created_at.toISOString()
        : null
      return reply.send(paginated(data, { cursor: nextCursor, limit }))
    },
  )

  // GET /api/v1/reports/:id
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const data = await svc.findById(req.params.id)
      return reply.send(ok(data))
    },
  )

  // POST /api/v1/reports  (multipart/form-data)
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const parts = req.parts()

      const fields: Record<string, string> = {}
      const imageFiles: Array<{ buffer: Buffer; mimetype: string; filename: string }> = []

      for await (const part of parts) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer()
          imageFiles.push({ buffer, mimetype: part.mimetype, filename: part.filename })
        } else {
          fields[part.fieldname] = part.value as string
        }
      }

      // Validate required fields manually (multipart bypasses JSON schema)
      if (!fields.type || !fields.title || !fields.location_lat || !fields.location_lng) {
        throw Errors.badRequest('type, title, location_lat, location_lng are required')
      }

      const report = await svc.create(
        req.user.sub,
        {
          type:           fields.type as ReportType,
          title:          fields.title,
          description:    fields.description,
          location_lat:   parseFloat(fields.location_lat),
          location_lng:   parseFloat(fields.location_lng),
          water_point_id: fields.water_point_id,
        },
        imageFiles,
      )

      // Publish to Redis for Socket.IO /map namespace (step 14)
      await fastify.redis.publish('map:reports', JSON.stringify({ event: 'report:new', data: report }))

      return reply.status(201).send(ok(report, 'Report submitted'))
    },
  )

  // PATCH /api/v1/reports/:id
  fastify.patch<{ Params: { id: string }; Body: { title?: string; description?: string } }>(
    '/:id',
    {
      schema: {
        body: {
          type: 'object',
          minProperties: 1,
          additionalProperties: false,
          properties: {
            title:       { type: 'string', minLength: 2, maxLength: 255 },
            description: { type: 'string' },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (req, reply) => {
      const data = await svc.update(req.params.id, req.user.sub, req.body)
      return reply.send(ok(data, 'Report updated'))
    },
  )

  // DELETE /api/v1/reports/:id
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      await svc.delete(req.params.id, req.user.sub, req.user.role)
      return reply.send(ok(null, 'Report deleted'))
    },
  )

  // POST /api/v1/reports/:id/upvote
  fastify.post<{ Params: { id: string } }>(
    '/:id/upvote',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const upvotes = await svc.upvote(req.params.id, req.user.sub)

      // Publish upvote update for live map
      await fastify.redis.publish(
        'map:reports',
        JSON.stringify({ event: 'report:updated', data: { reportId: req.params.id, upvotes } }),
      )

      return reply.send(ok({ upvotes }, 'Upvote recorded'))
    },
  )

  // PATCH /api/v1/reports/:id/status  (technician / admin only)
  fastify.patch<{ Params: { id: string }; Body: { status: ReportStatus } }>(
    '/:id/status',
    {
      schema: updateReportStatusSchema,
      preHandler: [fastify.authorize('admin', 'technician')],
    },
    async (req, reply) => {
      const data = await svc.updateStatus(req.params.id, req.body.status)

      const event = data.status === 'resolved' ? 'report:resolved' : 'report:updated'
      await fastify.redis.publish('map:reports', JSON.stringify({ event, data }))

      return reply.send(ok(data, 'Status updated'))
    },
  )
}
