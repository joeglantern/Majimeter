import type { FastifyInstance } from 'fastify'
import { AuthService } from '../../services/authService'
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../schemas/auth'
import type { RegisterBody, LoginBody, RefreshBody } from '../../schemas/auth'
import { ok } from '../../utils/response'

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify)

  // POST /api/v1/auth/register
  fastify.post<{ Body: RegisterBody }>(
    '/register',
    { schema: registerSchema },
    async (req, reply) => {
      const user = await authService.register(req.body)
      return reply.status(201).send(ok(user, 'Account created successfully'))
    },
  )

  // POST /api/v1/auth/login
  fastify.post<{ Body: LoginBody }>(
    '/login',
    { schema: loginSchema },
    async (req, reply) => {
      const tokens = await authService.login(req.body)
      return reply.send(ok(tokens))
    },
  )

  // POST /api/v1/auth/logout  (requires valid access token)
  fastify.post(
    '/logout',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      await authService.logout(req.user.sub)
      return reply.send(ok(null, 'Logged out successfully'))
    },
  )

  // POST /api/v1/auth/refresh
  fastify.post<{ Body: RefreshBody }>(
    '/refresh',
    { schema: refreshSchema },
    async (req, reply) => {
      const tokens = await authService.refresh(req.body.refreshToken)
      return reply.send(ok(tokens))
    },
  )

  // POST /api/v1/auth/forgot-password
  // Generates a 15-min reset token stored in Redis. Wire an email service to deliver it.
  fastify.post<{ Body: { email: string } }>(
    '/forgot-password',
    { schema: forgotPasswordSchema },
    async (req, reply) => {
      await authService.forgotPassword(req.body.email)
      // Always the same response — never leak whether the email exists
      return reply.send(ok(null, 'If that email is registered, a reset link has been sent'))
    },
  )

  // POST /api/v1/auth/reset-password
  // Consumes the reset token, updates the password, invalidates the active session.
  fastify.post<{ Body: { token: string; password: string } }>(
    '/reset-password',
    { schema: resetPasswordSchema },
    async (req, reply) => {
      await authService.resetPassword(req.body.token, req.body.password)
      return reply.send(ok(null, 'Password reset successfully. Please log in again.'))
    },
  )
}
