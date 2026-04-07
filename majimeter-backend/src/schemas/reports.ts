export const listReportsSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status:  { type: 'string', enum: ['open', 'in_progress', 'resolved', 'dismissed'] },
      type:    { type: 'string', enum: ['shortage', 'burst_pipe', 'contamination', 'infrastructure', 'other'] },
      lat:     { type: 'number' },
      lng:     { type: 'number' },
      radius:  { type: 'number', minimum: 0.1, maximum: 500 },
      cursor:  { type: 'string' },
      limit:   { type: 'number', minimum: 1, maximum: 100, default: 20 },
    },
  },
} as const

export const updateReportStatusSchema = {
  body: {
    type: 'object',
    required: ['status'],
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'dismissed'] },
    },
  },
} as const
