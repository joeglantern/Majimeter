# Builds the Fastify API only.
# All dependencies (Supabase, Upstash Redis, MQTT broker) are external cloud services
# configured via environment variables at runtime.

## ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

## ── Production stage ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S fastify -u 1001
USER fastify

EXPOSE 3000

CMD ["node", "dist/app.js"]
