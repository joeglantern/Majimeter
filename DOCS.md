# MajiMeter — Technical Documentation

This is the living technical reference for the MajiMeter project. Update it when things change — stale docs are worse than no docs.

---

## Table of Contents

1. [What is MajiMeter](#1-what-is-majimeter)
2. [Repo Structure](#2-repo-structure)
3. [Prerequisites](#3-prerequisites)
4. [Backend Setup](#4-backend-setup)
5. [Mobile Setup](#5-mobile-setup)
6. [Environment Variables](#6-environment-variables)
7. [Database](#7-database)
8. [API Reference](#8-api-reference)
9. [Socket.IO Events](#9-socketio-events)
10. [IoT / MQTT Data Flow](#10-iot--mqtt-data-flow)
11. [Authentication & Authorization](#11-authentication--authorization)
12. [Mobile App Structure](#12-mobile-app-structure)
13. [Water Points](#13-water-points)
14. [Gotchas & Known Issues](#14-gotchas--known-issues)
15. [What's Not Done Yet](#15-whats-not-done-yet)

---

## 1. What is MajiMeter

MajiMeter is a water infrastructure monitoring platform for low-resource communities. It combines:

- **IoT sensor ingestion** — flow rate, pressure, water level, temperature, and battery readings pushed over MQTT from field sensors
- **Community reporting** — mobile users report issues (burst pipes, shortages) tied to GPS coordinates
- **Live map** — all water points and active reports visible in real time via Socket.IO
- **Alerts** — automated anomaly detection triggers alerts when sensor readings cross configurable thresholds
- **Analytics** — time-series aggregation of sensor data per water point

The mobile app targets field users and community members. Admin/technician roles exist for water utility staff.

---

## 2. Repo Structure

```
Maji Meter/
├── majimeter-backend/     # Fastify API server
├── majimeter-mobile/      # Expo React Native app
├── ARCHITECTURE.md        # System architecture diagram and DB schema
├── DOCS.md                # This file
└── UI_DESIGN.md           # Design decisions and component guidelines
```

---

## 3. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | Both backend and mobile tooling |
| npm | 10+ | Backend uses npm |
| Expo CLI | latest | `npm install -g expo-cli` |
| Expo Go | SDK 54 | Install on your phone from the App Store / Play Store |
| Supabase account | — | Free tier works fine |
| Upstash account | — | Free Redis tier is enough for dev |

For Expo Go specifically — you must run the app in **Expo Go SDK 54**. Using a newer version of Expo Go will break native module compatibility. See [§14](#14-gotchas--known-issues).

---

## 4. Backend Setup

```bash
cd majimeter-backend
npm install
cp .env.example .env   # fill in your values — see §6
npm run migrate        # runs all SQL migrations in order
npm run seed           # inserts 12 test water points around Nairobi
npm run dev            # starts with tsx watch on port 3000
```

Other scripts:

```bash
npm run build          # compile TypeScript to dist/
npm start              # run compiled build (production)
npm test               # vitest
npm run lint
npm run format
```

The backend listens on `0.0.0.0:3000` by default. All routes are under `/api/v1`.

---

## 5. Mobile Setup

```bash
cd majimeter-mobile
npm install --legacy-peer-deps   # --legacy-peer-deps is required, see §14
```

Create a `.env` file:

```env
EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:3000/api/v1
```

Do **not** use `localhost` — on a physical device that resolves to the phone itself, not your dev machine. Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to get your LAN IP.

Then:

```bash
npx expo start --clear
```

Scan the QR code with Expo Go. Always use `--clear` if you've changed native dependencies or env vars.

---

## 6. Environment Variables

### Backend (`majimeter-backend/.env`)

```env
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Supabase — Dashboard → Settings → API
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Database — Dashboard → Settings → Database → Connection string (port 5432, not 6543)
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# Storage bucket name (create manually in Supabase Dashboard → Storage)
SUPABASE_STORAGE_BUCKET=report-images

# Redis — Upstash console → your database → rediss:// URL
REDIS_URL=rediss://default:[password]@[endpoint].upstash.io:6379

# MQTT broker
# Dev: use free public HiveMQ — no auth needed
# Prod: IoT team provides this
MQTT_BROKER_URL=mqtt://broker.hivemq.com:1883
MQTT_USERNAME=
MQTT_PASSWORD=

# JWT — generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=<64-char hex>
JWT_REFRESH_SECRET=<64-char hex>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Firebase FCM (leave blank if not testing push notifications)
FCM_PROJECT_ID=
FCM_PRIVATE_KEY=
FCM_CLIENT_EMAIL=

# Anomaly detection thresholds (%)/(bar)
THRESHOLD_WATER_LEVEL_LOW=20
THRESHOLD_WATER_LEVEL_CRITICAL=10
THRESHOLD_PRESSURE_HIGH=5.0
THRESHOLD_PRESSURE_LOW=0.5
THRESHOLD_FLOW_NO_FLOW=0.1
```

### Mobile (`majimeter-mobile/.env`)

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/api/v1
```

Expo only exposes env vars prefixed with `EXPO_PUBLIC_` to the JS bundle. Don't put secrets here.

---

## 7. Database

Hosted on **Supabase PostgreSQL**. No TimescaleDB — it's not available on Supabase. Time-series aggregation uses native `date_trunc()` with a composite index on `(water_point_id, time DESC)`.

### Migrations

Migrations live in `src/db/migrations/` and run in filename order. Run them with:

```bash
npm run migrate
```

The migration runner tracks which files have already been applied, so it's safe to run repeatedly.

Migration files:

| File | What it does |
|---|---|
| `001_extensions_and_enums.sql` | Creates all ENUM types |
| `002_create_users.sql` | Users table |
| `003_create_water_points.sql` | Water points table |
| `004_create_sensor_readings.sql` | Sensor readings table + indexes |
| `005_create_reports.sql` | Reports table |
| `006_create_alerts.sql` | Alerts table |
| `007_create_notifications.sql` | Notifications table |
| `008_create_report_upvotes.sql` | Report upvotes junction table |

### Enums

```sql
user_role:          user | technician | admin
water_point_type:   borehole | tank | pipe | tap
water_point_status: active | inactive | maintenance
report_type:        shortage | burst_pipe | contamination | infrastructure | other
report_status:      open | in_progress | resolved | dismissed
alert_type:         low_level | high_pressure | low_pressure | no_flow | leak_detected
alert_severity:     info | warning | critical
notification_type:  alert | report_update | system
```

### Schema

**users**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | |
| email | VARCHAR UNIQUE | |
| phone | VARCHAR | nullable |
| password_hash | VARCHAR | bcrypt |
| role | user_role | default: user |
| location_lat | DECIMAL | nullable — user's home area |
| location_lng | DECIMAL | nullable |
| fcm_token | VARCHAR | nullable — updated by mobile app on login |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**water_points**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | e.g. "Kibera Borehole A" |
| type | water_point_type | |
| location_lat | DECIMAL | |
| location_lng | DECIMAL | |
| address | TEXT | nullable |
| status | water_point_status | default: active |
| sensor_id | VARCHAR | nullable — links to IoT device ID |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**sensor_readings** *(indexed on `(water_point_id, time DESC)`)*
| Column | Type | Notes |
|---|---|---|
| time | TIMESTAMPTZ | partition key |
| sensor_id | VARCHAR | IoT device identifier |
| water_point_id | UUID FK | |
| flow_rate | DECIMAL | L/min, nullable |
| pressure | DECIMAL | bar, nullable |
| water_level | DECIMAL | %, nullable |
| temperature | DECIMAL | °C, nullable |
| battery_level | DECIMAL | %, nullable |

**reports**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | reporter |
| water_point_id | UUID FK | nullable — linked point if reported at one |
| type | report_type | |
| title | VARCHAR | |
| description | TEXT | nullable |
| location_lat | DECIMAL | GPS from device |
| location_lng | DECIMAL | |
| images | TEXT[] | array of Supabase Storage URLs |
| status | report_status | default: open |
| upvotes | INT | updated by trigger on report_upvotes |
| created_at | TIMESTAMPTZ | |
| resolved_at | TIMESTAMPTZ | nullable |

**alerts**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| water_point_id | UUID FK | |
| type | alert_type | |
| severity | alert_severity | |
| message | TEXT | human-readable description |
| triggered_at | TIMESTAMPTZ | |
| acknowledged_at | TIMESTAMPTZ | nullable |
| acknowledged_by | UUID FK | nullable — technician/admin who ack'd |

**notifications**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | |
| title | VARCHAR | |
| body | TEXT | |
| type | notification_type | |
| ref_id | UUID | nullable — ID of the alert or report |
| read | BOOLEAN | default: false |
| sent_at | TIMESTAMPTZ | |

**report_upvotes** *(junction table — PK is `(report_id, user_id)`)*
| Column | Type |
|---|---|
| report_id | UUID FK |
| user_id | UUID FK |

Upvoting is idempotent: `INSERT ... ON CONFLICT DO NOTHING`. The `reports.upvotes` column is a denormalized count recalculated after each insert.

### Seed Data

```bash
npm run seed
```

Inserts 12 test water points around Nairobi (boreholes, tanks, pipes, taps) with a mix of statuses and sensor IDs. The seed is idempotent — running it twice won't create duplicates.

---

## 8. API Reference

Base URL: `http://localhost:3000/api/v1`

All endpoints except auth require a `Bearer` token in the `Authorization` header. Responses follow this envelope:

```json
// Success
{ "success": true, "data": { ... } }

// Paginated
{ "success": true, "data": [ ... ], "pagination": { "cursor": "...", "limit": 20 } }

// Error
{ "success": false, "error": "message" }
```

### Auth

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | `{ name, email, password, phone? }` |
| POST | `/auth/login` | — | `{ email, password }` → returns `accessToken`, `refreshToken` |
| POST | `/auth/logout` | ✅ | Invalidates refresh token in Redis |
| POST | `/auth/refresh` | — | `{ refreshToken }` → new `accessToken` |
| POST | `/auth/forgot-password` | — | `{ email }` → sends reset email |
| POST | `/auth/reset-password` | — | `{ token, password }` |

### Users

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/users/me` | ✅ | Returns own profile |
| PATCH | `/users/me` | ✅ | Update name, phone, location |
| PUT | `/users/me/fcm-token` | ✅ | `{ fcm_token }` — called on every app launch |
| DELETE | `/users/me` | ✅ | Delete own account |
| GET | `/users` | admin | List all users |
| GET | `/users/:id` | admin | Get user by ID |
| PATCH | `/users/:id` | admin | Update user role etc. |

### Water Points

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/water-points` | ✅ | Params: `q`, `lat`, `lng`, `radius` (km), `status`, `limit` |
| GET | `/water-points/:id` | ✅ | Includes `latest_reading` from sensor |
| POST | `/water-points` | admin/tech | `{ name, type, location_lat, location_lng, address?, status?, sensor_id? }` |
| PATCH | `/water-points/:id` | admin/tech | Partial update of any field |
| GET | `/water-points/:id/sensors/live` | ✅ | Latest sensor reading |
| GET | `/water-points/:id/sensors/history` | ✅ | Params: `from`, `to` (ISO), `interval` (`raw`\|`1h`\|`1d`) |
| GET | `/water-points/:id/alerts` | ✅ | Cursor-paginated. Params: `cursor`, `limit` |
| GET | `/water-points/:id/reports` | ✅ | Cursor-paginated. Params: `cursor`, `limit` |

The `q` param on `GET /water-points` does a case-insensitive search on `name` and `address`.

### Reports

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/reports` | ✅ | Params: `status`, `type`, `lat`, `lng`, `radius`, `cursor`, `limit` |
| GET | `/reports/:id` | ✅ | Full report detail |
| POST | `/reports` | ✅ | `multipart/form-data` — fields: `type`, `title`, `location_lat`, `location_lng`, `description?`. File field: `images` (up to 5, 5MB each) |
| PATCH | `/reports/:id` | ✅ | Update own report's `title` or `description`. Only `open` reports. |
| DELETE | `/reports/:id` | ✅ / admin | Own reports only, or admin can delete any |
| POST | `/reports/:id/upvote` | ✅ | Idempotent. Returns `{ upvotes: number }` |
| PATCH | `/reports/:id/status` | admin/tech | `{ status }` — move through the workflow |

`status` only accepts one value per request. To filter `open` and `in_progress` reports simultaneously, make two parallel requests.

### Alerts

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/alerts` | ✅ | Params: `severity`, `type`, `water_point_id`, `cursor`, `limit` |
| GET | `/alerts/:id` | ✅ | |
| PATCH | `/alerts/:id/acknowledge` | admin/tech | Marks alert as acknowledged |

### Analytics

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/analytics/summary` | ✅ | Active water points, open reports, alert counts, readings today |
| GET | `/analytics/usage` | ✅ | Params: `water_point_id` (required), `period` (`daily`\|`weekly`\|`monthly`) |
| GET | `/analytics/anomalies` | ✅ | Alerts from the last 7 days joined with water point info. Param: `limit` |

### Notifications

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/notifications` | ✅ | Cursor-paginated, newest first |
| PATCH | `/notifications/:id/read` | ✅ | Mark single notification read |
| PATCH | `/notifications/read-all` | ✅ | Mark all unread notifications read |

### Sensor Ingest

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/ingest/sensor` | device key | Used by IoT devices, not mobile. Header: `X-Device-Key` |

---

## 9. Socket.IO Events

All namespaces require JWT auth passed in the socket handshake:

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/map', {
  auth: { token: `Bearer ${accessToken}` },
  transports: ['websocket'],
});
```

### `/sensors`

For subscribing to live sensor readings from a specific water point.

| Direction | Event | Payload |
|---|---|---|
| client → server | `join` | `{ waterPointId: string }` |
| client → server | `leave` | `{ waterPointId: string }` |
| server → client | `reading` | `{ flow_rate, pressure, water_level, temperature, battery_level, time }` |
| server → client | `sensor:offline` | `{ waterPointId, lastSeen }` |

Readings are emitted as **volatile** — if the client is slow they'll be dropped rather than queued. Suitable for real-time gauge displays.

### `/alerts`

| Direction | Event | Payload |
|---|---|---|
| client → server | `subscribe` | `{ severity?: 'info' \| 'warning' \| 'critical' }` — join a severity room |
| server → client | `alert:new` | Full alert object |
| server → client | `alert:acknowledged` | `{ alertId, acknowledgedBy, acknowledgedAt }` |

Not subscribing to a severity room means you receive all alerts.

### `/map`

Used by the mobile map screen.

| Direction | Event | Payload |
|---|---|---|
| client → server | `setViewport` | `{ north, south, east, west }` — assigns client to a 5-degree bbox room |
| server → client | `report:new` | New report object with coords |
| server → client | `report:updated` | Status or upvote change |
| server → client | `report:resolved` | Report closed |
| server → client | `alert:map` | Geo-located alert for map overlay |

> `waterpoint:status` is defined in the architecture but the backend doesn't publish to that channel yet.

---

## 10. IoT / MQTT Data Flow

```
IoT Sensor
  │  MQTT publish → topic: sensors/{sensorId}/data
  ▼
MQTT Broker (IoT team-managed in prod; HiveMQ public broker in dev)
  │  Backend subscribes via plugins/mqtt.ts
  ▼
Ingest handler (src/mqtt/subscriber.ts)
  ├── Validates payload
  ├── Writes to sensor_readings
  ├── Runs anomaly checks against env thresholds
  │     └── Anomaly found → inserts alert → publishes to Redis "alerts:new"
  │                       → Socket.IO /alerts emits "alert:new"
  │                       → Socket.IO /map emits "alert:map"
  └── Publishes normalized reading to Redis "sensor:{waterPointId}"
        └── Socket.IO /sensors emits "reading" to room waterPoint:{waterPointId}
```

MQTT does **not** go through NGINX. It's a direct TCP connection on port 1883/8883 from the backend process to the broker.

To simulate a sensor reading locally during development, publish a message to `sensors/{sensorId}/data` on the HiveMQ public broker. Use any MQTT client (e.g. MQTT Explorer).

Payload format expected by the ingest handler:

```json
{
  "sensorId": "sensor-001",
  "waterPointId": "uuid-of-water-point",
  "flow_rate": 12.4,
  "pressure": 2.1,
  "water_level": 78.0,
  "temperature": 22.5,
  "battery_level": 65.0
}
```

---

## 11. Authentication & Authorization

JWT-based. Two tokens:

- **Access token** — 15 minutes. Sent in `Authorization: Bearer <token>` header on every request.
- **Refresh token** — 7 days. Stored in Upstash Redis. Sent in request body to `POST /auth/refresh`.

On 401, the mobile Axios interceptor automatically tries to refresh. If the refresh also fails (token expired or revoked), both tokens are cleared from SecureStore and the user is logged out on next app launch.

Roles:

| Role | What they can do |
|---|---|
| `user` | Read everything, submit reports, upvote, manage own account |
| `technician` | Everything above + acknowledge alerts, update report status, create/update water points |
| `admin` | Everything above + manage users, delete any report |

Role checks use Fastify's `preHandler` hook — `fastify.authorize('admin', 'technician')`. Passing no role to `fastify.authenticate` only checks that the token is valid.

---

## 12. Mobile App Structure

Built with Expo SDK 54, Expo Router 6, React Native 0.81.5.

```
majimeter-mobile/
├── app/
│   ├── _layout.tsx              # Root layout — ThemeProvider, AuthProvider
│   ├── (auth)/                  # Login, register screens
│   └── (app)/
│       └── (tabs)/
│           ├── _layout.tsx      # Floating tab bar
│           ├── index.tsx        # Home / dashboard
│           ├── map.tsx          # Live map
│           ├── reports.tsx      # Community report feed
│           ├── alerts.tsx       # Alert feed (technician/admin)
│           ├── analytics.tsx    # Usage charts (admin)
│           └── profile.tsx      # User profile + theme toggle
├── context/
│   └── AuthContext.tsx          # Auth state, token storage, restore session
├── hooks/
│   └── useTheme.ts              # Dark mode hook + ThemeProvider
├── lib/
│   └── api.ts                   # Axios instance, interceptors, token refresh
├── constants/
│   └── Theme.ts                 # Color palette, spacing, typography, shadows
└── .env                         # EXPO_PUBLIC_API_URL (not committed)
```

**Navigation** uses Expo Router's file-based routing. Use `router.navigate()` and `usePathname()` — not React Navigation's `navigation.emit()`. The tab bar is a custom `FloatingTabBar` component that reads `usePathname()` directly to determine the active tab.

**Theming** works via `ThemeProvider` in `_layout.tsx`. `useTheme()` returns the current color set and a `toggleTheme()` function. Colors adapt to the system preference by default and can be overridden by the toggle.

**API calls** all go through `lib/api.ts`. The Axios instance automatically attaches the access token and handles 401 refresh. Don't use raw `fetch` or create a second Axios instance.

---

## 13. Water Points

A water point is a physical water infrastructure location. Four types:

| Type | Description |
|---|---|
| `borehole` | Drilled well with electric or hand pump |
| `tank` | Elevated storage reservoir or overhead tank |
| `pipe` | Distribution pipeline junction, valve, or main |
| `tap` | Public tap stand or kiosk |

Each water point has a `status`:

- `active` — operational
- `inactive` — decommissioned or offline
- `maintenance` — temporarily out of service

When a water point has a `sensor_id`, the IoT device publishes readings that the backend ingests. The mobile app fetches the latest reading when the user taps the marker (`GET /water-points/:id/sensors/live`).

Water points without a `sensor_id` are still shown on the map — they just won't have live metrics.

Only `admin` and `technician` roles can create or update water points. Regular users can view them, see their sensor data, and submit reports against them.

---

## 14. Gotchas & Known Issues

**`react-native-worklets` must be exactly `0.5.1`**

Expo Go SDK 54 bundles the native side of `react-native-worklets@0.5.1`. Using `0.8.x` or newer causes a TurboModule crash at startup. When that module fails, Expo Router can't evaluate `map.tsx` and `reports.tsx`, so those routes appear missing ("Unmatched Route"). Always install with:

```bash
npm install --legacy-peer-deps
```

**`localhost` doesn't work on a physical device**

Use your machine's LAN IP in `.env`. Both devices must be on the same Wi-Fi. If the connection is still refused, check that Windows Firewall isn't blocking port 3000:

```bash
netsh advfirewall firewall add rule name="MajiMeter Backend" dir=in action=allow protocol=TCP localport=3000
```

**`additionalProperties: false` on all route schemas**

The backend uses Fastify's JSON schema validation with `additionalProperties: false` on querystrings. If you add a new filter to the mobile app, you must also add it to the corresponding schema file in `src/schemas/` or you'll get a 400.

**Multiple values for the same query param**

Fastify validates `status` as `type: string` (single value). Passing `?status=open&status=in_progress` sends an array which fails validation. Make two separate requests instead.

**Tab navigation — use Expo Router APIs only**

The custom floating tab bar uses `usePathname()` and `router.navigate()` from `expo-router`. Don't touch React Navigation's `navigation.emit()` or the tabs will stop responding. Expo Router 6 handles all navigation internally.

**Always use `npx expo start --clear` after**:
- Installing or updating packages
- Changing `.env`
- Changing `babel.config.js` or `tsconfig.json`

**`tsconfig.json` `ignoreDeprecations`**

The project uses `"baseUrl": "."` for `@/` path aliases which is deprecated in TypeScript 6.x. `"ignoreDeprecations": "6.0"` in `tsconfig.json` silences the warning without changing behaviour.

---

## 15. What's Not Done Yet

These are features that are planned or partially designed but not implemented:

- **Offline report queue** — reports submitted without internet should be queued locally (SQLite) and synced when back online. Expo SQLite is already available.
- **`waterpoint:status` Socket.IO event** — the architecture defines it but the backend doesn't publish to that channel. Water point status changes don't propagate to the map in real time.
- **Sensor history charts on mobile** — the backend supports `GET /water-points/:id/sensors/history` with `1h`/`1d` aggregation, but the mobile analytics screen doesn't use it yet.
- **Map clustering** — at high zoom-out levels, markers should cluster. No clustering library is installed.
- **Push notifications end-to-end** — FCM env vars are in `.env.example` but the notification dispatch worker is not fully wired. Notifications are stored in the DB but not always pushed.
- **Password reset flow on mobile** — the backend has `forgot-password` and `reset-password` endpoints but the mobile screens aren't built.
- **Admin panel** — there's no web admin dashboard. Admins currently use the mobile app or direct DB access.
