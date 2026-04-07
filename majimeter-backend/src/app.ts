import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'

import dbPlugin from './plugins/db'
import redisPlugin from './plugins/redis'
import authPlugin from './plugins/auth'
import storagePlugin from './plugins/storage'
import mqttPlugin    from './plugins/mqtt'
import socketioPlugin from './plugins/socketio'

import authRoutes         from './routes/auth'
import userRoutes         from './routes/users'
import waterPointRoutes   from './routes/water-points'
import ingestRoutes       from './routes/ingest'
import reportRoutes       from './routes/reports'
import alertRoutes        from './routes/alerts'
import analyticsRoutes    from './routes/analytics'
import notificationRoutes from './routes/notifications'

import { AppError } from './utils/errors'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    ...(process.env.NODE_ENV !== 'production' && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    }),
  },
})

async function bootstrap() {
  // ── Security middleware ──────────────────────────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, { origin: true, credentials: true })
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, context) => ({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Too many requests. Retry after ${context.after}`,
    }),
  })

  // ── Core plugins (order matters — db/redis must be ready before auth/mqtt) ───
  await app.register(dbPlugin)
  await app.register(redisPlugin)
  await app.register(authPlugin)
  await app.register(storagePlugin)
  await app.register(socketioPlugin)
  await app.register(mqttPlugin)

  // ── Routes ───────────────────────────────────────────────────────────────────
  await app.register(authRoutes,         { prefix: '/api/v1/auth' })
  await app.register(userRoutes,         { prefix: '/api/v1/users' })
  await app.register(waterPointRoutes,   { prefix: '/api/v1/water-points' })
  await app.register(ingestRoutes,       { prefix: '/api/v1/ingest' })
  await app.register(reportRoutes,       { prefix: '/api/v1/reports' })
  await app.register(alertRoutes,        { prefix: '/api/v1/alerts' })
  await app.register(analyticsRoutes,    { prefix: '/api/v1/analytics' })
  await app.register(notificationRoutes, { prefix: '/api/v1/notifications' })

  // ── Global error handler ─────────────────────────────────────────────────────
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message,
      })
    }

    // Fastify validation errors (schema mismatch)
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.validation,
      })
    }

    app.log.error(error)
    return reply.status(500).send({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    })
  })

  // ── Health check ─────────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))
}

async function start() {
  await bootstrap()

  const port = parseInt(process.env.PORT ?? '3000')
  const host = process.env.HOST ?? '0.0.0.0'

  try {
    await app.listen({ port, host })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
