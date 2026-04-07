import fp from 'fastify-plugin'
import jwtPlugin from '@fastify/jwt'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { Errors } from '../utils/errors'

export type UserRole = 'user' | 'technician' | 'admin'

export interface JwtPayload {
  sub: string
  email: string
  role: UserRole
  /** Distinguishes access tokens from refresh tokens */
  type: 'access' | 'refresh'
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * preHandler: verifies the Bearer JWT and populates req.user.
     * Throws 401 if missing, invalid, or is a refresh token.
     */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>

    /**
     * Returns a preHandler that runs authenticate then checks role.
     * Usage: preHandler: [fastify.authorize('admin', 'technician')]
     */
    authorize: (...roles: UserRole[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export default fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(jwtPlugin, {
      secret: process.env.JWT_ACCESS_SECRET!,
    })

    fastify.decorate(
      'authenticate',
      async (req: FastifyRequest, _reply: FastifyReply) => {
        try {
          await req.jwtVerify()
        } catch {
          throw Errors.unauthorized()
        }
        if (req.user.type !== 'access') {
          throw Errors.unauthorized('Invalid token type')
        }
      },
    )

    fastify.decorate(
      'authorize',
      (...roles: UserRole[]) =>
        async (req: FastifyRequest, reply: FastifyReply) => {
          await fastify.authenticate(req, reply)
          if (!roles.includes(req.user.role)) {
            throw Errors.forbidden()
          }
        },
    )
  },
  { name: 'auth', dependencies: ['redis'] },
)
