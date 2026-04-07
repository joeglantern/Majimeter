import * as argon2 from 'argon2'
import * as jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'
import type { FastifyInstance } from 'fastify'
import type { JwtPayload } from '../plugins/auth'
import type { UserRow } from '../types/db'
import { Errors } from '../utils/errors'

const RESET_TTL_SECONDS = 15 * 60 // 15 minutes

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

export class AuthService {
  private readonly accessSecret = process.env.JWT_ACCESS_SECRET!
  private readonly refreshSecret = process.env.JWT_REFRESH_SECRET!
  private readonly accessExpiry = (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn']
  private readonly refreshExpiry = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn']

  constructor(private readonly fastify: FastifyInstance) {}

  async register(data: { name: string; email: string; password: string; phone?: string }) {
    const { db } = this.fastify

    const [existing] = await db<Pick<UserRow, 'id'>[]>`
      SELECT id FROM users WHERE email = ${data.email}
    `
    if (existing) throw Errors.conflict('Email already registered')

    const passwordHash = await argon2.hash(data.password)

    const [user] = await db<Omit<UserRow, 'password_hash' | 'fcm_token' | 'location_lat' | 'location_lng' | 'updated_at'>[]>`
      INSERT INTO users (name, email, password_hash, phone)
      VALUES (${data.name}, ${data.email}, ${passwordHash}, ${data.phone ?? null})
      RETURNING id, name, email, phone, role, created_at
    `

    return user
  }

  async login(data: { email: string; password: string }) {
    const { db } = this.fastify

    const [user] = await db<Pick<UserRow, 'id' | 'email' | 'password_hash' | 'role'>[]>`
      SELECT id, email, password_hash, role
      FROM users
      WHERE email = ${data.email}
    `
    if (!user) throw Errors.unauthorized('Invalid credentials')

    const valid = await argon2.verify(user.password_hash, data.password)
    if (!valid) throw Errors.unauthorized('Invalid credentials')

    return this.issueTokens({ id: user.id, email: user.email, role: user.role })
  }

  async logout(userId: string) {
    await this.fastify.redis.del(`refresh:${userId}`)
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload
    try {
      payload = jwt.verify(refreshToken, this.refreshSecret) as JwtPayload
    } catch {
      throw Errors.unauthorized('Invalid or expired refresh token')
    }

    if (payload.type !== 'refresh') throw Errors.unauthorized('Invalid token type')

    // Check the token is still the one we issued (guards against token reuse after logout)
    const stored = await this.fastify.redis.get(`refresh:${payload.sub}`)
    if (stored !== refreshToken) throw Errors.unauthorized('Refresh token revoked')

    // Fetch latest user data in case role changed
    const [user] = await this.fastify.db<Pick<UserRow, 'id' | 'email' | 'role'>[]>`
      SELECT id, email, role FROM users WHERE id = ${payload.sub}
    `
    if (!user) throw Errors.unauthorized()

    return this.issueTokens({ id: user.id, email: user.email, role: user.role })
  }

  /**
   * Generates a short-lived password-reset token and stores it in Redis.
   * Returns the raw token so the caller (route) can hand it to an email service.
   * Always returns the same generic success — never reveals whether the email exists.
   */
  async forgotPassword(email: string): Promise<void> {
    const [user] = await this.fastify.db<Pick<UserRow, 'id'>[]>`
      SELECT id FROM users WHERE email = ${email}
    `
    // Silently no-op for unknown emails — callers must show the same generic message
    if (!user) return

    const token = randomBytes(32).toString('hex')
    await this.fastify.redis.setex(`reset:${token}`, RESET_TTL_SECONDS, user.id)

    // In production wire this token into an email link, e.g.:
    //   await emailService.sendResetLink(email, token)
    // For now log at debug so local dev can still exercise the full flow.
    this.fastify.log.debug({ token }, 'Password reset token generated (send in email link)')
  }

  /**
   * Validates a reset token from Redis, updates the password, then invalidates
   * both the reset token and any active refresh session (forces re-login).
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.fastify.redis.get(`reset:${token}`)
    if (!userId) throw Errors.badRequest('Invalid or expired reset token')

    const passwordHash = await argon2.hash(newPassword)

    await this.fastify.db`
      UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}
    `

    // Consume the reset token and any active session in one go
    await Promise.all([
      this.fastify.redis.del(`reset:${token}`),
      this.fastify.redis.del(`refresh:${userId}`),
    ])
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async issueTokens(user: { id: string; email: string; role: string }) {
    const base: Omit<JwtPayload, 'type'> = {
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
    }

    const accessToken = jwt.sign(
      { ...base, type: 'access' } satisfies JwtPayload,
      this.accessSecret,
      { algorithm: 'HS256', expiresIn: this.accessExpiry },
    )

    const refreshToken = jwt.sign(
      { ...base, type: 'refresh' } satisfies JwtPayload,
      this.refreshSecret,
      { algorithm: 'HS256', expiresIn: this.refreshExpiry },
    )

    // Overwrite previous refresh token — one active session per user
    await this.fastify.redis.setex(`refresh:${user.id}`, REFRESH_TTL_SECONDS, refreshToken)

    return { accessToken, refreshToken }
  }
}
