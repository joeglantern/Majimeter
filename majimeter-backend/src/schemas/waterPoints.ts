// Fastify JSON schemas for water-points routes

export const createWaterPointSchema = {
  body: {
    type: 'object',
    required: ['name', 'type', 'location_lat', 'location_lng'],
    additionalProperties: false,
    properties: {
      name:         { type: 'string', minLength: 2, maxLength: 255 },
      type:         { type: 'string', enum: ['borehole', 'tank', 'pipe', 'tap'] },
      location_lat: { type: 'number', minimum: -90,  maximum: 90  },
      location_lng: { type: 'number', minimum: -180, maximum: 180 },
      address:      { type: 'string', maxLength: 500 },
      status:       { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
      sensor_id:    { type: 'string', maxLength: 100 },
    },
  },
} as const

export const updateWaterPointSchema = {
  body: {
    type: 'object',
    minProperties: 1,
    additionalProperties: false,
    properties: {
      name:         { type: 'string', minLength: 2, maxLength: 255 },
      type:         { type: 'string', enum: ['borehole', 'tank', 'pipe', 'tap'] },
      location_lat: { type: 'number', minimum: -90,  maximum: 90  },
      location_lng: { type: 'number', minimum: -180, maximum: 180 },
      address:      { type: 'string', maxLength: 500 },
      status:       { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
      sensor_id:    { type: 'string', maxLength: 100 },
    },
  },
} as const

export const listWaterPointsSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      lat:    { type: 'number' },
      lng:    { type: 'number' },
      radius: { type: 'number', minimum: 0.1, maximum: 500 }, // km
      status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
    },
  },
} as const

export const sensorHistorySchema = {
  querystring: {
    type: 'object',
    required: ['from', 'to'],
    additionalProperties: false,
    properties: {
      from:     { type: 'string' }, // ISO date string
      to:       { type: 'string' },
      interval: { type: 'string', enum: ['raw', '1h', '1d'], default: '1h' },
    },
  },
} as const

export const paginationSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      cursor: { type: 'string' },
      limit:  { type: 'number', minimum: 1, maximum: 100, default: 20 },
    },
  },
} as const
