// src/db/seed.ts
// Run with: npm run seed
// Inserts test water points around Nairobi for development/demo purposes.

import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config()

const db = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

const waterPoints = [
  // ── Boreholes ──────────────────────────────────────────────────────────
  {
    name: 'Kibera Borehole A',
    type: 'borehole',
    location_lat: -1.3133,
    location_lng: 36.7836,
    address: 'Kibera Drive, Nairobi',
    status: 'active',
    sensor_id: 'sensor-001',
  },
  {
    name: 'Mathare Borehole',
    type: 'borehole',
    location_lat: -1.2600,
    location_lng: 36.8587,
    address: 'Mathare Valley, Nairobi',
    status: 'active',
    sensor_id: 'sensor-002',
  },
  {
    name: 'Ruiru Community Borehole',
    type: 'borehole',
    location_lat: -1.1467,
    location_lng: 36.9593,
    address: 'Ruiru Town, Kiambu County',
    status: 'maintenance',
    sensor_id: 'sensor-003',
  },

  // ── Tanks ──────────────────────────────────────────────────────────────
  {
    name: 'Westlands Elevated Tank',
    type: 'tank',
    location_lat: -1.2635,
    location_lng: 36.8027,
    address: 'Westlands, Nairobi',
    status: 'active',
    sensor_id: 'sensor-004',
  },
  {
    name: 'Eastlands Water Tower',
    type: 'tank',
    location_lat: -1.2833,
    location_lng: 36.8800,
    address: 'Eastleigh, Nairobi',
    status: 'active',
    sensor_id: 'sensor-005',
  },
  {
    name: 'Karen Storage Tank',
    type: 'tank',
    location_lat: -1.3310,
    location_lng: 36.7150,
    address: 'Karen, Nairobi',
    status: 'inactive',
    sensor_id: null,
  },

  // ── Pipes / Mains ──────────────────────────────────────────────────────
  {
    name: 'CBD Main Pipeline Junction',
    type: 'pipe',
    location_lat: -1.2864,
    location_lng: 36.8172,
    address: 'Tom Mboya Street, Nairobi CBD',
    status: 'active',
    sensor_id: 'sensor-006',
  },
  {
    name: 'Ngong Road Distribution Pipe',
    type: 'pipe',
    location_lat: -1.3005,
    location_lng: 36.7750,
    address: 'Ngong Road, Adams Arcade',
    status: 'active',
    sensor_id: null,
  },
  {
    name: 'Thika Road Feeder Pipe',
    type: 'pipe',
    location_lat: -1.2456,
    location_lng: 36.8789,
    address: 'Thika Superhighway, Kasarani',
    status: 'maintenance',
    sensor_id: 'sensor-007',
  },

  // ── Public Taps ────────────────────────────────────────────────────────
  {
    name: 'Pumwani Public Tap',
    type: 'tap',
    location_lat: -1.2760,
    location_lng: 36.8490,
    address: 'Pumwani Road, Nairobi',
    status: 'active',
    sensor_id: null,
  },
  {
    name: 'Korogocho Community Tap',
    type: 'tap',
    location_lat: -1.2490,
    location_lng: 36.8820,
    address: 'Korogocho, Nairobi',
    status: 'active',
    sensor_id: null,
  },
  {
    name: 'Kawangware Tap Stand',
    type: 'tap',
    location_lat: -1.2910,
    location_lng: 36.7560,
    address: 'Kawangware, Nairobi',
    status: 'active',
    sensor_id: null,
  },
]

async function seed() {
  console.log('🌱 Seeding water points...\n')

  let inserted = 0
  let skipped = 0

  for (const wp of waterPoints) {
    // Check if already exists by name to keep seed idempotent
    const [existing] = await db`
      SELECT id FROM water_points WHERE name = ${wp.name}
    `

    if (existing) {
      console.log(`  ⏭  Skipped (exists): ${wp.name}`)
      skipped++
      continue
    }

    await db`
      INSERT INTO water_points (name, type, location_lat, location_lng, address, status, sensor_id)
      VALUES (
        ${wp.name},
        ${wp.type}::water_point_type,
        ${wp.location_lat},
        ${wp.location_lng},
        ${wp.address},
        ${wp.status}::water_point_status,
        ${wp.sensor_id}
      )
    `
    console.log(`  ✅ Inserted: ${wp.name} (${wp.type}, ${wp.status}${wp.sensor_id ? ', has sensor' : ''})`)
    inserted++
  }

  console.log(`\n✨ Done — ${inserted} inserted, ${skipped} skipped`)
  await db.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
