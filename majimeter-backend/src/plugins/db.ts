import fp from 'fastify-plugin'
import postgres from 'postgres'
import type { FastifyInstance } from 'fastify'
import type { Sql } from 'postgres'

declare module 'fastify' {
  interface FastifyInstance {
    db: Sql
  }
}

export default fp(
  async (fastify: FastifyInstance) => {
    const sql = postgres(process.env.DATABASE_URL!, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 30,
      ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
      // Suppress noisy TimescaleDB / Supabase notices
      onnotice: () => {},
    })

    // Verify connection at startup
    await sql`SELECT 1`
    fastify.log.info('Database connected')

    fastify.decorate('db', sql)

    fastify.addHook('onClose', async () => {
      await sql.end()
    })
  },
  { name: 'db' },
)
