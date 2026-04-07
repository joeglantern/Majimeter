import fp from 'fastify-plugin'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FastifyInstance } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient
  }
}

export default fp(
  async (fastify: FastifyInstance) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )

    fastify.decorate('supabase', supabase)
    fastify.log.info('Supabase storage client ready')
  },
  { name: 'storage' },
)
