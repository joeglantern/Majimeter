import type { FastifyInstance } from 'fastify'
import type { UserRole } from '../../types/db'
import {
  updateMeSchema,
  updateFcmTokenSchema,
  adminUpdateUserSchema,
  listUsersSchema,
} from '../../schemas/users'
import { ok, paginated } from '../../utils/response'
import { Errors } from '../../utils/errors'

export default async function userRoutes(fastify: FastifyInstance) {
  const { db } = fastify

  // ── Self-service routes ──────────────────────────────────────────────────────

  // GET /api/v1/users/me
  fastify.get(
    '/me',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const [user] = await db`
        SELECT id, name, email, phone, role, location_lat, location_lng, created_at, updated_at
        FROM   users
        WHERE  id = ${req.user.sub}
      `
      if (!user) throw Errors.notFound('User')
      return reply.send(ok(user))
    },
  )

  // PATCH /api/v1/users/me  — update own profile fields (name, phone, location)
  fastify.patch<{
    Body: { name?: string; phone?: string; location_lat?: number; location_lng?: number }
  }>(
    '/me',
    { schema: updateMeSchema, preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const fields = Object.entries(req.body).filter(([, v]) => v !== undefined)
      if (fields.length === 0) throw Errors.badRequest('No fields to update')

      const setClauses = fields.map(([key, value]) => db`${db(key)} = ${value}`)
      const setClause  = setClauses.reduce((acc, c) => db`${acc}, ${c}`)

      const [updated] = await db`
        UPDATE users
        SET    ${setClause}
        WHERE  id = ${req.user.sub}
        RETURNING id, name, email, phone, role, location_lat, location_lng, created_at, updated_at
      `
      return reply.send(ok(updated, 'Profile updated'))
    },
  )

  // PUT /api/v1/users/me/fcm-token  — register or refresh push notification token
  fastify.put<{ Body: { fcm_token: string } }>(
    '/me/fcm-token',
    { schema: updateFcmTokenSchema, preHandler: [fastify.authenticate] },
    async (req, reply) => {
      await db`
        UPDATE users
        SET    fcm_token = ${req.body.fcm_token}
        WHERE  id        = ${req.user.sub}
      `
      return reply.send(ok(null, 'FCM token registered'))
    },
  )

  // DELETE /api/v1/users/me/fcm-token  — deregister token on device logout
  fastify.delete(
    '/me/fcm-token',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      await db`
        UPDATE users
        SET    fcm_token = NULL
        WHERE  id        = ${req.user.sub}
      `
      return reply.send(ok(null, 'FCM token cleared'))
    },
  )

  // ── Admin routes ─────────────────────────────────────────────────────────────

  // GET /api/v1/users  — list all users (admin only), cursor-paginated
  fastify.get<{
    Querystring: { role?: UserRole; cursor?: string; limit?: number }
  }>(
    '/',
    { schema: listUsersSchema, preHandler: [fastify.authorize('admin')] },
    async (req, reply) => {
      const { role, cursor, limit = 20 } = req.query

      const roleFilter   = role   ? db`AND role = ${role}::user_role`              : db``
      const cursorFilter = cursor ? db`AND created_at < ${new Date(cursor)}`       : db``

      const data = await db`
        SELECT id, name, email, phone, role, location_lat, location_lng, created_at, updated_at
        FROM   users
        WHERE  TRUE
        ${roleFilter}
        ${cursorFilter}
        ORDER  BY created_at DESC
        LIMIT  ${limit}
      `

      const nextCursor =
        data.length === limit
          ? (data[data.length - 1] as { created_at: Date }).created_at.toISOString()
          : null

      return reply.send(paginated(data, { cursor: nextCursor, limit }))
    },
  )

  // GET /api/v1/users/:id  — get any user by id (admin only)
  // NOTE: declared after /me so find-my-way's static-route priority applies
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authorize('admin')] },
    async (req, reply) => {
      const [user] = await db`
        SELECT id, name, email, phone, role, location_lat, location_lng, created_at, updated_at
        FROM   users
        WHERE  id = ${req.params.id}
      `
      if (!user) throw Errors.notFound('User')
      return reply.send(ok(user))
    },
  )

  // PATCH /api/v1/users/:id  — admin can update name, role, phone of any user
  fastify.patch<{
    Params: { id: string }
    Body: { name?: string; role?: UserRole; phone?: string }
  }>(
    '/:id',
    { schema: adminUpdateUserSchema, preHandler: [fastify.authorize('admin')] },
    async (req, reply) => {
      const fields = Object.entries(req.body).filter(([, v]) => v !== undefined)
      if (fields.length === 0) throw Errors.badRequest('No fields to update')

      const [existing] = await db`SELECT id FROM users WHERE id = ${req.params.id}`
      if (!existing) throw Errors.notFound('User')

      const setClauses = fields.map(([key, value]) => {
        if (key === 'role') return db`role = ${value}::user_role`
        return db`${db(key)} = ${value}`
      })
      const setClause = setClauses.reduce((acc, c) => db`${acc}, ${c}`)

      const [updated] = await db`
        UPDATE users
        SET    ${setClause}
        WHERE  id = ${req.params.id}
        RETURNING id, name, email, phone, role, location_lat, location_lng, created_at, updated_at
      `
      return reply.send(ok(updated, 'User updated'))
    },
  )
}
