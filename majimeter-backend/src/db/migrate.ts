import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import postgres from 'postgres'
import 'dotenv/config'

async function migrate() {
  const sql = postgres(process.env.DATABASE_URL!, {
    max: 1,
    ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  })

  try {
    // Track applied migrations
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    const applied = await sql<{ filename: string }[]>`
      SELECT filename FROM schema_migrations ORDER BY filename
    `
    const appliedSet = new Set(applied.map((r) => r.filename))

    const migrationsDir = join(__dirname, 'migrations')
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    let count = 0
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  skip  ${file}`)
        continue
      }

      const content = readFileSync(join(migrationsDir, file), 'utf8')

      await sql.begin(async (tx) => {
        await tx.unsafe(content)
        // tx is TransactionSql — Omit<> strips call signatures, use unsafe with $1 param
        await tx.unsafe('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
      })

      console.log(`  apply ${file}`)
      count++
    }

    console.log(`\nDone. ${count} migration(s) applied.`)
  } finally {
    await sql.end()
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
