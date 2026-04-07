// Fastify JSON schemas for users routes

export const updateMeSchema = {
  body: {
    type: 'object',
    minProperties: 1,
    additionalProperties: false,
    properties: {
      name:         { type: 'string', minLength: 2, maxLength: 100 },
      phone:        { type: 'string', maxLength: 20 },
      location_lat: { type: 'number', minimum: -90,  maximum: 90  },
      location_lng: { type: 'number', minimum: -180, maximum: 180 },
    },
  },
} as const

export const updateFcmTokenSchema = {
  body: {
    type: 'object',
    required: ['fcm_token'],
    additionalProperties: false,
    properties: {
      fcm_token: { type: 'string', minLength: 1 },
    },
  },
} as const

export const adminUpdateUserSchema = {
  body: {
    type: 'object',
    minProperties: 1,
    additionalProperties: false,
    properties: {
      name:  { type: 'string', minLength: 2, maxLength: 100 },
      role:  { type: 'string', enum: ['user', 'technician', 'admin'] },
      phone: { type: 'string', maxLength: 20 },
    },
  },
} as const

export const listUsersSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      role:   { type: 'string', enum: ['user', 'technician', 'admin'] },
      cursor: { type: 'string' },
      limit:  { type: 'number', minimum: 1, maximum: 100, default: 20 },
    },
  },
} as const
