# MajiMeter – System Architecture

## Tech Stack Decision

| Layer | Choice | Reason |
|---|---|---|
| Backend API | **Fastify (Node.js + TypeScript)** | High throughput for IoT data ingestion, native async, Socket.IO support, low overhead |
| Real-Time | **Socket.IO (`@fastify/socket.io`)** | Namespaced channels, rooms, auto-reconnect, fallback transport, auth middleware |
| Database | **Supabase (PostgreSQL)** | Hosted PostgreSQL — relational integrity + native partitioning for IoT time-series |
| Cache / Pub-Sub | **Upstash Redis** | Serverless Redis — refresh tokens, Socket.IO adapter, rate limiting. Free tier, no infra to run |
| IoT Transport | **MQTT** | IoT team runs their own broker. Dev testing uses free public HiveMQ broker |
| File Storage | **Supabase Storage** | Community report images — co-located with DB, no extra vendor |
| Push Notifications | **Firebase Cloud Messaging (FCM)** | Cross-platform push to Expo mobile app |
| Mobile App | **Expo (React Native)** | Cross-platform iOS & Android |
| Reverse Proxy | **Nginx** | SSL termination, rate limiting, load balancing |

---

## High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                          IOT LAYER                               │
│                                                                  │
│   [Flow Sensors]  [Pressure Sensors]  [Level Sensors]           │
│          │               │                  │                    │
│          └───────────────┴──────────────────┘                   │
│                          │  MQTT publish                         │
│                 ┌────────▼───────────┐                          │
│                 │   MQTT Broker      │                           │
│                 │  (IoT team-owned;  │                           │
│                 │   HiveMQ in dev)   │                           │
│                 └────────┬───────────┘                          │
└──────────────────────────┼───────────────────────────────────────┘
                           │ MQTT subscribe (port 1883/8883)
                           │ direct connection — bypasses NGINX
                           ▼
          ┌────────────────────────────────────────┐
          │      FASTIFY SERVER (single process)   │
          │                                        │
          │  ┌─────────────────────────────────┐  │
          │  │  plugins/mqtt.ts                │  │
          │  │  MQTT subscriber → ingest →     │  │
          │  │  anomaly check → Redis publish  │  │
          │  └─────────────────────────────────┘  │
          │                                        │
          │◄──── HTTP/WS ── NGINX GATEWAY ────────►│
          │              (SSL, Rate Limit,         │
          │               Reverse Proxy)           │
          │                                        │
          │  REST API routes:                      │
          │    /auth  /users  /water-points        │
          │    /reports  /ingest  /alerts          │
          │    /analytics  /notifications          │
          │                                        │
          │  Socket.IO (@fastify/socket.io):       │
          │    ns: /sensors  rooms: waterPoint:{id}│
          │    ns: /alerts   rooms: severity:{lvl} │
          │    ns: /map      rooms: bbox:{lat}:{lng}│
          └────────────────┬───────────────────────┘
                           │
          ┌────────────────┼──────────────────────┐
          ▼                ▼                      ▼
┌──────────────────┐  ┌─────────────┐  ┌─────────────────────────┐
│  Supabase        │  │   Redis     │  │  External Services      │
│  (PostgreSQL)    │  │  (Upstash)  │  │                         │
│                  │  │             │  │  - FCM (push notifs)    │
│  - users         │  │  - Pub/Sub  │  │  - Supabase Storage     │
│  - reports       │  │  - Sessions │  │    (report images)      │
│  - water_points  │  │  - Rate lim │  │  - react-native-maps    │
│  - sensor_reads  │  │  - Sio relay│  │    (Apple Maps / Google)│
│  - alerts        │  └─────────────┘  └─────────────────────────┘
│  - notifications │
└──────────────────┘

                    ┌─────────────────────────┐
                    │      MOBILE CLIENT      │
                    │   Expo (React Native)   │
                    │                         │
                    │  - Auth screens         │
                    │  - Dashboard/monitoring │
                    │  - Community reports    │
                    │  - Interactive map      │
                    │  - Analytics/insights   │
                    │  - Notifications        │
                    └─────────────────────────┘
```

---

## Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | |
| email | VARCHAR UNIQUE | |
| phone | VARCHAR | Optional, for SMS fallback |
| password_hash | VARCHAR | |
| role | ENUM | `user`, `technician`, `admin` |
| location_lat | DECIMAL | User's home area |
| location_lng | DECIMAL | |
| fcm_token | VARCHAR | For push notifications |
| created_at | TIMESTAMPTZ | |

### `water_points`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | e.g. "Borehole A – Kawangware" |
| type | ENUM | `borehole`, `tank`, `pipe`, `tap` |
| location_lat | DECIMAL | |
| location_lng | DECIMAL | |
| address | TEXT | |
| status | ENUM | `active`, `inactive`, `maintenance` |
| sensor_id | VARCHAR | Links to IoT device ID |
| created_at | TIMESTAMPTZ | |

### `sensor_readings` (regular PostgreSQL table, indexed on `time DESC`)
> TimescaleDB is not available on Supabase. Native `date_trunc()` is used for aggregations with composite indexes for efficient time-range queries. PostgreSQL declarative partitioning (`PARTITION BY RANGE (time)`) can be added when data volume warrants it.

| Column | Type | Notes |
|---|---|---|
| time | TIMESTAMPTZ NOT NULL | Indexed (time DESC) |
| sensor_id | VARCHAR | IoT device identifier |
| water_point_id | UUID FK | |
| flow_rate | DECIMAL | L/min |
| pressure | DECIMAL | Bar |
| water_level | DECIMAL | % or cm |
| temperature | DECIMAL | Optional |
| battery_level | DECIMAL | % (if wireless) |

### `reports`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | Reporter |
| water_point_id | UUID FK | Nullable (reported point) |
| type | ENUM | `shortage`, `burst_pipe`, `contamination`, `infrastructure`, `other` |
| title | VARCHAR | |
| description | TEXT | |
| location_lat | DECIMAL | GPS from device |
| location_lng | DECIMAL | |
| images | TEXT[] | Array of image URLs |
| status | ENUM | `open`, `in_progress`, `resolved`, `dismissed` |
| upvotes | INT | Community confirmation |
| created_at | TIMESTAMPTZ | |
| resolved_at | TIMESTAMPTZ | Nullable |

### `alerts`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| water_point_id | UUID FK | |
| type | ENUM | `low_level`, `high_pressure`, `low_pressure`, `no_flow`, `leak_detected` |
| severity | ENUM | `info`, `warning`, `critical` |
| message | TEXT | |
| triggered_at | TIMESTAMPTZ | |
| acknowledged_at | TIMESTAMPTZ | Nullable |
| acknowledged_by | UUID FK | Nullable |

### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | |
| title | VARCHAR | |
| body | TEXT | |
| type | ENUM | `alert`, `report_update`, `system` |
| ref_id | UUID | ID of alert or report |
| read | BOOLEAN | Default false |
| sent_at | TIMESTAMPTZ | |

---

## API Endpoints

### Auth
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
```

### Users
```
GET    /api/v1/users/me
PATCH  /api/v1/users/me
PUT    /api/v1/users/me/fcm-token
DELETE /api/v1/users/me
GET    /api/v1/users                      (admin)
GET    /api/v1/users/:id                  (admin)
PATCH  /api/v1/users/:id                  (admin)
```

### Water Points
```
GET    /api/v1/water-points              (with geo bbox filter)
GET    /api/v1/water-points/:id
POST   /api/v1/water-points             (admin/technician)
PATCH  /api/v1/water-points/:id         (admin/technician)
GET    /api/v1/water-points/:id/sensors/live
GET    /api/v1/water-points/:id/sensors/history?from=&to=&interval=
GET    /api/v1/water-points/:id/alerts
GET    /api/v1/water-points/:id/reports
```

### Sensor Data (IoT Ingestion)
```
POST   /api/v1/ingest/sensor            (authenticated by device API key)
GET    /api/v1/sensors/:sensorId/latest
GET    /api/v1/sensors/:sensorId/history
```

### Reports
```
GET    /api/v1/reports                  (filters: status, type, bbox, radius)
GET    /api/v1/reports/:id
POST   /api/v1/reports
PATCH  /api/v1/reports/:id
DELETE /api/v1/reports/:id
POST   /api/v1/reports/:id/upvote
PATCH  /api/v1/reports/:id/status       (admin/technician)
```

### Alerts
```
GET    /api/v1/alerts                   (filters: severity, type, water_point)
GET    /api/v1/alerts/:id
PATCH  /api/v1/alerts/:id/acknowledge   (admin/technician)
```

### Analytics
```
GET    /api/v1/analytics/usage?water_point_id=&period=daily|weekly|monthly
GET    /api/v1/analytics/summary
GET    /api/v1/analytics/anomalies
```

### Notifications
```
GET    /api/v1/notifications
PATCH  /api/v1/notifications/:id/read
PATCH  /api/v1/notifications/read-all
```

### Socket.IO Namespaces & Events

**Authentication** — JWT passed in handshake auth on every namespace:
```ts
// client
io('/sensors', { auth: { token: 'Bearer <accessToken>' } })
```
Server middleware validates the token before allowing connection.

---

**Namespace `/sensors`**
| Direction | Event | Payload |
|---|---|---|
| client → server | `join` | `{ waterPointId: string }` — join a water point room |
| client → server | `leave` | `{ waterPointId: string }` |
| server → client | `reading` | latest sensor snapshot for that water point |
| server → client | `sensor:offline` | `{ waterPointId, lastSeen }` — no reading for >5 min |

Rooms: `waterPoint:{waterPointId}` — server emits only to the relevant room.

---

**Namespace `/alerts`**
| Direction | Event | Payload |
|---|---|---|
| client → server | `subscribe` | `{ severity?: 'info'\|'warning'\|'critical' }` — optional room filter |
| server → client | `alert:new` | full alert object |
| server → client | `alert:acknowledged` | `{ alertId, acknowledgedBy, acknowledgedAt }` |

Rooms: `severity:critical`, `severity:warning`, `severity:info` — clients can subscribe to specific severity levels, or stay in the default room for all alerts.

---

**Namespace `/map`**
| Direction | Event | Payload |
|---|---|---|
| client → server | `setViewport` | `{ north, south, east, west }` — server moves client to bbox room |
| server → client | `report:new` | new community report with geo coords |
| server → client | `report:updated` | status/upvote change on existing report |
| server → client | `report:resolved` | report closed |
| server → client | `alert:map` | geo-located alert for map pin overlay |

> `waterpoint:status` was planned but is not yet published — no `map:waterpoints` Redis channel is wired up in the current backend.

Rooms: dynamic bbox rooms so high-traffic areas don't flood unrelated clients.

---

## IoT Data Flow

```
IoT Sensor
   │
   │  MQTT publish → topic: sensors/{sensorId}/data
   ▼
Mosquitto Broker
   │
   │  Backend subscribes to sensors/#
   ▼
IoT Ingestion Service (Fastify plugin)
   │
   ├── Validate & normalize payload
   ├── Write to sensor_readings (PostgreSQL, indexed on time DESC)
   ├── Run anomaly checks (compare against thresholds)
   │      ├── If anomaly → create alert → publish to Redis pub/sub
   │      │      ├── Socket.IO emits `alert:new` on /alerts namespace
   │      │      └── Socket.IO emits `alert:map` on /map namespace
   │      └── Alert subscriber → FCM push notification to relevant users
   │
   └── Publish normalized reading to Redis pub/sub
          └── Socket.IO Redis adapter broadcasts `reading` event
                to room waterPoint:{waterPointId} on /sensors namespace
```

---

## Authentication & Authorization

- JWT-based auth (access token: 15min, refresh token: 7 days stored in Redis)
- Role-based access control (RBAC): `user`, `technician`, `admin`
- IoT devices authenticated by static API key in request header (`X-Device-Key`)
- Routes decorated with Fastify `preHandler` hooks for role checks

---

## Low-Bandwidth Optimizations

- Paginated list endpoints (cursor-based)
- Sensor history supports `interval` param (e.g., `1h`, `6h`, `1d`) to return aggregated points instead of raw readings
- Image uploads compressed before storage; thumbnails served separately
- Socket.IO messages use compact JSON payloads; volatile emits used for high-frequency sensor readings (dropped if client is slow, no buffering)
- Offline-capable mobile app with local SQLite queue for report submission *(planned — not yet implemented)*

---

## Deployment Topology

```
Cloud VPS / Kubernetes
├── nginx (reverse proxy, SSL via Let's Encrypt)
├── fastify-api (2+ instances behind nginx)
└── worker process (alert engine, notification dispatch)

Managed / Serverless (no infra to run)
├── Supabase — PostgreSQL + Storage
├── Upstash  — Redis (refresh tokens, Socket.IO adapter)
├── IoT team — MQTT broker (we subscribe, they operate it)
└── Firebase — FCM push notifications

External APIs
└── MapBox / Google Maps (map tiles & geocoding)
```

---

## Project Folder Structure (Backend)

```
majimeter-backend/
├── src/
│   ├── plugins/           # Fastify plugins: db, redis, auth, mqtt, socketio, storage
│   │   ├── auth.ts        # JWT sign/verify, authenticate & authorize decorators
│   │   ├── db.ts          # postgres.js client
│   │   ├── redis.ts       # Upstash Redis client
│   │   ├── mqtt.ts        # MQTT broker connection
│   │   ├── socketio.ts    # Socket.IO server + /sensors, /alerts, /map namespaces
│   │   └── storage.ts     # Supabase Storage client
│   ├── routes/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── water-points/
│   │   ├── reports/
│   │   ├── ingest/        # IoT sensor data ingestion (POST /ingest/sensor)
│   │   ├── alerts/
│   │   ├── analytics/
│   │   └── notifications/
│   ├── services/          # Business logic (auth, reports, waterPoints, alerts, notifications, anomaly)
│   ├── schemas/           # JSON Schema validation (auth, reports, users, waterPoints)
│   ├── db/
│   │   ├── migrate.ts     # Migration runner
│   │   └── migrations/    # SQL migration files
│   ├── mqtt/
│   │   └── subscriber.ts  # MQTT topic subscriber + ingest handler
│   ├── types/             # Shared TypeScript types (db row types, enums)
│   ├── utils/             # Response helpers, error factory
│   └── app.ts             # Fastify instance + plugin registration
├── .env.example
└── package.json
```
