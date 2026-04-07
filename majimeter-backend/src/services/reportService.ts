import type { Sql } from 'postgres'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReportRow, ReportStatus, ReportType } from '../types/db'
import { Errors } from '../utils/errors'
import { randomUUID } from 'crypto'

const KM_PER_DEGREE = 111
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'report-images'

export class ReportService {
  constructor(
    private readonly db: Sql,
    private readonly supabase: SupabaseClient,
  ) {}

  async list(filters: {
    status?: ReportStatus
    type?: ReportType
    lat?: number
    lng?: number
    radius?: number
    cursor?: Date | null
    limit: number
  }) {
    const { status, type, lat, lng, radius, cursor, limit } = filters

    const geoFilter =
      lat != null && lng != null && radius != null
        ? this.db`
            AND location_lat BETWEEN ${lat - radius / KM_PER_DEGREE}
                                 AND ${lat + radius / KM_PER_DEGREE}
            AND location_lng BETWEEN ${lng - radius / KM_PER_DEGREE}
                                 AND ${lng + radius / KM_PER_DEGREE}
          `
        : this.db``

    const statusFilter = status ? this.db`AND status = ${status}::report_status` : this.db``
    const typeFilter   = type   ? this.db`AND type   = ${type}::report_type`     : this.db``
    const cursorFilter = cursor ? this.db`AND created_at < ${cursor}`            : this.db``

    return this.db<ReportRow[]>`
      SELECT id, user_id, water_point_id, type, title, description,
             location_lat, location_lng, images, status, upvotes, created_at, resolved_at
      FROM   reports
      WHERE  TRUE
      ${geoFilter}
      ${statusFilter}
      ${typeFilter}
      ${cursorFilter}
      ORDER  BY created_at DESC
      LIMIT  ${limit}
    `
  }

  async findById(id: string) {
    const [report] = await this.db<ReportRow[]>`
      SELECT * FROM reports WHERE id = ${id}
    `
    if (!report) throw Errors.notFound('Report')
    return report
  }

  async create(
    userId: string,
    data: {
      type: ReportType
      title: string
      description?: string
      location_lat: number
      location_lng: number
      water_point_id?: string
    },
    imageFiles: Array<{ buffer: Buffer; mimetype: string; filename: string }>,
  ) {
    // Upload images to Supabase Storage
    const imageUrls = await Promise.all(
      imageFiles.map((file) => this.uploadImage(file)),
    )

    const [report] = await this.db<ReportRow[]>`
      INSERT INTO reports
        (user_id, water_point_id, type, title, description, location_lat, location_lng, images)
      VALUES (
        ${userId},
        ${data.water_point_id ?? null},
        ${data.type}::report_type,
        ${data.title},
        ${data.description ?? null},
        ${data.location_lat},
        ${data.location_lng},
        ${imageUrls}
      )
      RETURNING *
    `
    return report
  }

  async update(id: string, userId: string, data: { title?: string; description?: string }) {
    const existing = await this.findById(id)

    if (existing.user_id !== userId) throw Errors.forbidden('You can only edit your own reports')
    if (existing.status !== 'open') throw Errors.badRequest('Only open reports can be edited')

    const fields = Object.entries(data).filter(([, v]) => v !== undefined)
    if (fields.length === 0) throw Errors.badRequest('No fields to update')

    const setClauses = fields.map(([key, value]) => this.db`${this.db(key)} = ${value}`)
    const setClause  = setClauses.reduce((acc, c) => this.db`${acc}, ${c}`)

    const [updated] = await this.db<ReportRow[]>`
      UPDATE reports SET ${setClause} WHERE id = ${id} RETURNING *
    `
    return updated
  }

  async delete(id: string, userId: string, role: string) {
    const report = await this.findById(id)
    if (report.user_id !== userId && role !== 'admin') throw Errors.forbidden()

    await this.db`DELETE FROM reports WHERE id = ${id}`
  }

  async upvote(reportId: string, userId: string) {
    // Insert into junction table — PK conflict = already upvoted (idempotent)
    await this.db`
      INSERT INTO report_upvotes (report_id, user_id)
      VALUES (${reportId}, ${userId})
      ON CONFLICT DO NOTHING
    `

    // Recount from source of truth
    const [{ count }] = await this.db<{ count: string }[]>`
      SELECT COUNT(*) FROM report_upvotes WHERE report_id = ${reportId}
    `

    await this.db`UPDATE reports SET upvotes = ${parseInt(count)} WHERE id = ${reportId}`

    return parseInt(count)
  }

  async updateStatus(id: string, status: ReportStatus) {
    await this.findById(id)

    const resolvedAt = status === 'resolved' ? new Date() : null

    const [updated] = await this.db<ReportRow[]>`
      UPDATE reports
      SET    status      = ${status}::report_status,
             resolved_at = ${resolvedAt}
      WHERE  id          = ${id}
      RETURNING *
    `
    return updated
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async uploadImage(file: {
    buffer: Buffer
    mimetype: string
    filename: string
  }): Promise<string> {
    const ext  = file.filename.split('.').pop() ?? 'jpg'
    const path = `${randomUUID()}.${ext}`

    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false })

    if (error) throw Errors.internal(`Image upload failed: ${error.message}`)

    const { data } = this.supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  }
}
