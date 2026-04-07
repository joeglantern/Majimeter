// lib/socket.ts
// Singleton Socket.IO clients for the three namespaces:
//   /sensors  — live sensor readings (volatile, per water-point rooms)
//   /alerts   — new alerts & acknowledgements (severity rooms)
//   /map      — real-time report & water point events (viewport rooms)
//
// Auth: each socket passes the JWT in the handshake `auth` object.
// Connections are lazy — sockets only connect when first accessed.

import { io, Socket } from 'socket.io-client';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3000';

// ── Factory ────────────────────────────────────────────────────────────────────

function createSocket(namespace: string, token: string): Socket {
  return io(`${BASE_URL}${namespace}`, {
    auth: { token: `Bearer ${token}` },
    transports: ['websocket'],
    autoConnect: false,   // We control when to connect
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });
}

// ── Singletons ─────────────────────────────────────────────────────────────────

let sensorsSocket: Socket | null = null;
let alertsSocket: Socket | null = null;
let mapSocket: Socket | null = null;

export function getSensorsSocket(token: string): Socket {
  if (!sensorsSocket) sensorsSocket = createSocket('/sensors', token);
  return sensorsSocket;
}

export function getAlertsSocket(token: string): Socket {
  if (!alertsSocket) alertsSocket = createSocket('/alerts', token);
  return alertsSocket;
}

export function getMapSocket(token: string): Socket {
  if (!mapSocket) mapSocket = createSocket('/map', token);
  return mapSocket;
}

// ── Cleanup ────────────────────────────────────────────────────────────────────
// Call this on logout to fully disconnect and reset all sockets.

export function disconnectAllSockets() {
  sensorsSocket?.disconnect();
  alertsSocket?.disconnect();
  mapSocket?.disconnect();
  sensorsSocket = null;
  alertsSocket = null;
  mapSocket = null;
}
