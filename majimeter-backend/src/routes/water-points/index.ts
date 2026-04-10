import type { FastifyInstance } from 'fastify'
import { WaterPointService } from '../../services/waterPointService'
import {
  createWaterPointSchema,
  updateWaterPointSchema,
  listWaterPointsSchema,
  sensorHistorySchema,
  paginationSchema,
} from '../../schemas/waterPoints'
import type { WaterPointStatus, WaterPointType } from '../../types/db'
import { ok, paginated } from '../../utils/response'
import { Errors } from '../../utils/errors'

export default async function waterPointRoutes(fastify: FastifyInstance) {
  const svc = new WaterPointService(fastify.db)

  // GET /api/v1/water-points
  fastify.get<{
    Querystring: { q?: string; lat?: number; lng?: number; radius?: number; status?: WaterPointStatus; limit?: number }
  }>(
    '/',
    { schema: listWaterPointsSchema, preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { q, lat, lng, radius, status, limit } = req.query
      const data = await svc.list({ q, lat, lng, radius, status, limit })
      return reply.send(ok(data))
    },
  )

  // GET /api/v1/water-points/:id
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const data = await svc.findById(req.params.id)
      return reply.send(ok(data))
    },
  )

  // POST /api/v1/water-points  (admin or technician only)
  fastify.post<{
    Body: {
      name: string
      type: WaterPointType
      location_lat: number
      location_lng: number
      address?: string
      status?: WaterPointStatus
      sensor_id?: string
    }
  }>(
    '/',
    {
      schema: createWaterPointSchema,
      preHandler: [fastify.authorize('admin', 'technician')],
    },
    async (req, reply) => {
      const data = await svc.create(req.body)
      return reply.status(201).send(ok(data, 'Water point created'))
    },
  )

  // PATCH /api/v1/water-points/:id  (admin or technician only)
  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/:id',
    {
      schema: updateWaterPointSchema,
      preHandler: [fastify.authorize('admin', 'technician')],
    },
    async (req, reply) => {
      const data = await svc.update(req.params.id, req.body as Parameters<typeof svc.update>[1])
      return reply.send(ok(data, 'Water point updated'))
    },
  )

  // GET /api/v1/water-points/:id/sensors/live
  fastify.get<{ Params: { id: string } }>(
    '/:id/sensors/live',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const reading = await svc.getLatestReading(req.params.id)
      return reply.send(ok(reading))
    },
  )

  // GET /api/v1/water-points/:id/sensors/history?from=&to=&interval=
  fastify.get<{
    Params: { id: string }
    Querystring: { from: string; to: string; interval?: 'raw' | '1h' | '1d' }
  }>(
    '/:id/sensors/history',
    { schema: sensorHistorySchema, preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { from, to, interval = '1h' } = req.query

      const fromDate = new Date(from)
      const toDate = new Date(to)

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw Errors.badRequest('Invalid date format for from/to')
      }
      if (fromDate >= toDate) {
        throw Errors.badRequest('from must be before to')
      }

      const data = await svc.getSensorHistory(req.params.id, fromDate, toDate, interval)
      return reply.send(ok(data))
    },
  )

  // GET /api/v1/water-points/:id/alerts?cursor=&limit=
  fastify.get<{
    Params: { id: string }
    Querystring: { cursor?: string; limit?: number }
  }>(
    '/:id/alerts',
    { schema: paginationSchema, preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const limit = req.query.limit ?? 20
      const cursor = req.query.cursor ? new Date(req.query.cursor) : null

      const data = await svc.getAlerts(req.params.id, cursor, limit)
      const nextCursor = data.length === limit ? (data[data.length - 1] as { triggered_at: Date }).triggered_at : null

      return reply.send(paginated(data, { cursor: nextCursor?.toISOString() ?? null, limit }))
    },
  )

  // GET /api/v1/water-points/:id/reports?cursor=&limit=
  fastify.get<{
    Params: { id: string }
    Querystring: { cursor?: string; limit?: number }
  }>(
    '/:id/reports',
    { schema: paginationSchema, preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const limit = req.query.limit ?? 20
      const cursor = req.query.cursor ? new Date(req.query.cursor) : null

      const data = await svc.getReports(req.params.id, cursor, limit)
      const nextCursor = data.length === limit ? (data[data.length - 1] as { created_at: Date }).created_at : null

      return reply.send(paginated(data, { cursor: nextCursor?.toISOString() ?? null, limit }))
    },
  )
}
