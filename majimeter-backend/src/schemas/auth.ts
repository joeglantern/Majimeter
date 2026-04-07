import { z } from 'zod'

// ── Zod schemas (for type inference and manual validation if needed) ───────────

export const registerBodySchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  phone: z.string().max(20).optional(),
})

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export const refreshBodySchema = z.object({
  refreshToken: z.string(),
})

export type RegisterBody = z.infer<typeof registerBodySchema>
export type LoginBody = z.infer<typeof loginBodySchema>
export type RefreshBody = z.infer<typeof refreshBodySchema>

// ── Fastify JSON Schemas (used by Fastify's AJV for fast request validation) ──

export const registerSchema = {
  body: {
    type: 'object',
    required: ['name', 'email', 'password'],
    additionalProperties: false,
    properties: {
      name:     { type: 'string', minLength: 2, maxLength: 100 },
      email:    { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8, maxLength: 100 },
      phone:    { type: 'string', maxLength: 20 },
    },
  },
} as const

export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    additionalProperties: false,
    properties: {
      email:    { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 1 },
    },
  },
} as const

export const refreshSchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    additionalProperties: false,
    properties: {
      refreshToken: { type: 'string', minLength: 1 },
    },
  },
} as const

export const forgotPasswordSchema = {
  body: {
    type: 'object',
    required: ['email'],
    additionalProperties: false,
    properties: {
      email: { type: 'string', format: 'email' },
    },
  },
} as const

export const resetPasswordSchema = {
  body: {
    type: 'object',
    required: ['token', 'password'],
    additionalProperties: false,
    properties: {
      token:    { type: 'string', minLength: 1 },
      password: { type: 'string', minLength: 8, maxLength: 100 },
    },
  },
} as const
