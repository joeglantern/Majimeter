import fp from 'fastify-plugin'
import IORedis from 'ioredis'
import type { FastifyInstance } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    redis: IORedis
  }
}

export default fp(
  async (fastify: FastifyInstance) => {
    // Upstash uses rediss:// (TLS) — ioredis handles it automatically from the URL
    const redis = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      // Required for Upstash TLS
      tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
    })

    await redis.connect()
    fastify.log.info('Redis connected')

    fastify.decorate('redis', redis)

    fastify.addHook('onClose', async () => {
      await redis.quit()
    })
  },
  { name: 'redis' },
)
