import fp from 'fastify-plugin'
import socketio from 'fastify-socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import IORedis from 'ioredis'
import type { FastifyInstance } from 'fastify'
import type { Socket } from 'socket.io'
import * as jwt from 'jsonwebtoken'
import type { JwtPayload } from './auth'

/**
 * Verifies the JWT passed in socket.handshake.auth.token.
 * Rejects the connection if missing or invalid.
 */
function makeAuthMiddleware() {
  return (socket: Socket, next: (err?: Error) => void) => {
    const raw: string = socket.handshake.auth?.token ?? ''
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw

    if (!token) return next(new Error('Missing token'))

    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtPayload
      if (payload.type !== 'access') return next(new Error('Invalid token type'))
      socket.data.user = payload
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  }
}

export default fp(
  async (fastify: FastifyInstance) => {
    // Separate Redis clients for pub/sub adapter (ioredis requires two connections)
    const pubClient = new IORedis(process.env.REDIS_URL!, {
      tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
    })
    const subClient = pubClient.duplicate()

    await fastify.register(socketio, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
      transports: ['websocket', 'polling'],
    })

    // Wire Redis adapter for multi-instance broadcasting
    fastify.io.adapter(createAdapter(pubClient, subClient))

    const auth = makeAuthMiddleware()

    // ── /sensors namespace ───────────────────────────────────────────────────
    const sensorsNs = fastify.io.of('/sensors')
    sensorsNs.use(auth)

    sensorsNs.on('connection', (socket) => {
      fastify.log.debug({ userId: socket.data.user.sub }, 'Socket /sensors connected')

      socket.on('join', ({ waterPointId }: { waterPointId: string }) => {
        void socket.join(`waterPoint:${waterPointId}`)
      })

      socket.on('leave', ({ waterPointId }: { waterPointId: string }) => {
        void socket.leave(`waterPoint:${waterPointId}`)
      })

      socket.on('disconnect', () => {
        fastify.log.debug({ userId: socket.data.user.sub }, 'Socket /sensors disconnected')
      })
    })

    // Subscribe to Redis and fan-out to /sensors rooms
    const sensorsSub = pubClient.duplicate()
    await sensorsSub.psubscribe('sensor:*')
    sensorsSub.on('pmessage', (_pattern, channel, message) => {
      const waterPointId = channel.replace('sensor:', '')
      // Volatile = dropped if client is slow, no queue build-up
      sensorsNs.to(`waterPoint:${waterPointId}`).volatile.emit('reading', JSON.parse(message))
    })

    // ── /alerts namespace ────────────────────────────────────────────────────
    const alertsNs = fastify.io.of('/alerts')
    alertsNs.use(auth)

    alertsNs.on('connection', (socket) => {
      fastify.log.debug({ userId: socket.data.user.sub }, 'Socket /alerts connected')

      // Optional: subscribe to a specific severity room
      socket.on('subscribe', ({ severity }: { severity?: string }) => {
        if (severity) void socket.join(`severity:${severity}`)
      })
    })

    const alertsSub = pubClient.duplicate()
    await alertsSub.subscribe('alerts:new', 'alerts:acknowledged')
    alertsSub.on('message', (channel, message) => {
      const data = JSON.parse(message)

      if (channel === 'alerts:new') {
        // Broadcast to severity room AND catch-all (sockets that didn't subscribe to a room)
        alertsNs.to(`severity:${data.severity}`).emit('alert:new', data)
        alertsNs.except([`severity:info`, `severity:warning`, `severity:critical`]).emit('alert:new', data)
      }

      if (channel === 'alerts:acknowledged') {
        alertsNs.emit('alert:acknowledged', data)
      }
    })

    // ── /map namespace ────────────────────────────────────────────────────────
    const mapNs = fastify.io.of('/map')
    mapNs.use(auth)

    mapNs.on('connection', (socket) => {
      fastify.log.debug({ userId: socket.data.user.sub }, 'Socket /map connected')

      // Client sends its current map viewport; server assigns a bbox room
      socket.on('setViewport', (bbox: { north: number; south: number; east: number; west: number }) => {
        // Leave any previous viewport rooms
        for (const room of socket.rooms) {
          if (room.startsWith('bbox:')) void socket.leave(room)
        }
        // Bucket to ~5-degree grid cells for room assignment
        const latBucket = Math.floor(bbox.south / 5) * 5
        const lngBucket = Math.floor(bbox.west  / 5) * 5
        void socket.join(`bbox:${latBucket}:${lngBucket}`)
      })
    })

    const mapSub = pubClient.duplicate()
    await mapSub.subscribe('map:reports', 'map:alerts')
    mapSub.on('message', (channel, message) => {
      const { event, data } = JSON.parse(message)

      if (channel === 'map:reports') {
        // Broadcast to all map clients (viewport filtering is client-side for reports)
        mapNs.emit(event, data)
      }

      if (channel === 'map:alerts') {
        mapNs.emit('alert:map', data)
      }
    })

    fastify.addHook('onClose', async () => {
      await Promise.all([
        sensorsSub.quit(),
        alertsSub.quit(),
        mapSub.quit(),
        pubClient.quit(),
        subClient.quit(),
      ])
    })

    fastify.log.info('Socket.IO ready: /sensors, /alerts, /map')
  },
  { name: 'socketio', dependencies: ['redis'] },
)
