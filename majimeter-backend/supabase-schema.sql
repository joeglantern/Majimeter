-- ============================================================
-- MajiMeter – Full Schema
-- Paste this entire file into Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────

-- ── Enums ────────────────────────────────────────────────────
CREATE TYPE user_role          AS ENUM ('user', 'technician', 'admin');
CREATE TYPE water_point_type   AS ENUM ('borehole', 'tank', 'pipe', 'tap');
CREATE TYPE water_point_status AS ENUM ('active', 'inactive', 'maintenance');
CREATE TYPE report_type        AS ENUM ('shortage', 'burst_pipe', 'contamination', 'infrastructure', 'other');
CREATE TYPE report_status      AS ENUM ('open', 'in_progress', 'resolved', 'dismissed');
CREATE TYPE alert_type         AS ENUM ('low_level', 'high_pressure', 'low_pressure', 'no_flow', 'leak_detected');
CREATE TYPE alert_severity     AS ENUM ('info', 'warning', 'critical');
CREATE TYPE notification_type  AS ENUM ('alert', 'report_update', 'system');

-- ── updated_at trigger function ───────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── users ────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone         VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role          user_role    NOT NULL DEFAULT 'user',
  location_lat  DECIMAL(10, 8),
  location_lng  DECIMAL(11, 8),
  fcm_token     TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role  ON users (role);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── water_points ─────────────────────────────────────────────
CREATE TABLE water_points (
  id           UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255)       NOT NULL,
  type         water_point_type   NOT NULL,
  location_lat DECIMAL(10, 8)     NOT NULL,
  location_lng DECIMAL(11, 8)     NOT NULL,
  address      TEXT,
  status       water_point_status NOT NULL DEFAULT 'active',
  sensor_id    VARCHAR(100)       UNIQUE,
  created_at   TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_water_points_status    ON water_points (status);
CREATE INDEX idx_water_points_sensor_id ON water_points (sensor_id);
CREATE INDEX idx_water_points_location  ON water_points (location_lat, location_lng);

CREATE TRIGGER water_points_set_updated_at
  BEFORE UPDATE ON water_points
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── sensor_readings ───────────────────────────────────────────
CREATE TABLE sensor_readings (
  time           TIMESTAMPTZ    NOT NULL,
  sensor_id      VARCHAR(100)   NOT NULL,
  water_point_id UUID           NOT NULL REFERENCES water_points (id) ON DELETE CASCADE,
  flow_rate      DECIMAL(10, 4),
  pressure       DECIMAL(10, 4),
  water_level    DECIMAL(10, 4),
  temperature    DECIMAL(6,  2),
  battery_level  DECIMAL(5,  2)
);

CREATE INDEX idx_sensor_readings_sensor_id   ON sensor_readings (sensor_id,      time DESC);
CREATE INDEX idx_sensor_readings_water_point ON sensor_readings (water_point_id, time DESC);

-- ── reports ───────────────────────────────────────────────────
CREATE TABLE reports (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  water_point_id UUID          REFERENCES water_points (id) ON DELETE SET NULL,
  type           report_type   NOT NULL,
  title          VARCHAR(255)  NOT NULL,
  description    TEXT,
  location_lat   DECIMAL(10, 8) NOT NULL,
  location_lng   DECIMAL(11, 8) NOT NULL,
  images         TEXT[]        NOT NULL DEFAULT '{}',
  status         report_status NOT NULL DEFAULT 'open',
  upvotes        INT           NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ
);

CREATE INDEX idx_reports_user_id        ON reports (user_id);
CREATE INDEX idx_reports_water_point_id ON reports (water_point_id);
CREATE INDEX idx_reports_status         ON reports (status);
CREATE INDEX idx_reports_type           ON reports (type);
CREATE INDEX idx_reports_location       ON reports (location_lat, location_lng);
CREATE INDEX idx_reports_created_at     ON reports (created_at DESC);

-- ── alerts ────────────────────────────────────────────────────
CREATE TABLE alerts (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  water_point_id   UUID           NOT NULL REFERENCES water_points (id) ON DELETE CASCADE,
  type             alert_type     NOT NULL,
  severity         alert_severity NOT NULL,
  message          TEXT           NOT NULL,
  triggered_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  acknowledged_at  TIMESTAMPTZ,
  acknowledged_by  UUID           REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_alerts_water_point_id ON alerts (water_point_id);
CREATE INDEX idx_alerts_severity       ON alerts (severity);
CREATE INDEX idx_alerts_triggered_at   ON alerts (triggered_at DESC);
CREATE INDEX idx_alerts_unacknowledged ON alerts (triggered_at DESC)
  WHERE acknowledged_at IS NULL;

-- ── notifications ─────────────────────────────────────────────
CREATE TABLE notifications (
  id      UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID              NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title   VARCHAR(255)      NOT NULL,
  body    TEXT              NOT NULL,
  type    notification_type NOT NULL,
  ref_id  UUID,
  read    BOOLEAN           NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications (user_id, sent_at DESC);
CREATE INDEX idx_notifications_unread  ON notifications (user_id) WHERE read = false;

-- ── report_upvotes ────────────────────────────────────────────
CREATE TABLE report_upvotes (
  report_id  UUID        NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users   (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (report_id, user_id)
);

-- ── schema_migrations (tracks applied migrations if using the runner) ─────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
