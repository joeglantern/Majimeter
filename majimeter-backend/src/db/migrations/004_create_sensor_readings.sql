-- Regular PostgreSQL table (TimescaleDB not available on Supabase).
-- Use date_trunc() for time-bucket aggregations.
-- Add declarative partitioning (PARTITION BY RANGE (time)) when data volume warrants it.

CREATE TABLE sensor_readings (
  time           TIMESTAMPTZ    NOT NULL,
  sensor_id      VARCHAR(100)   NOT NULL,
  water_point_id UUID           NOT NULL REFERENCES water_points (id) ON DELETE CASCADE,
  flow_rate      DECIMAL(10, 4),           -- L/min
  pressure       DECIMAL(10, 4),           -- bar
  water_level    DECIMAL(10, 4),           -- % or cm
  temperature    DECIMAL(6,  2),           -- °C, optional
  battery_level  DECIMAL(5,  2)            -- %, optional
);

-- Efficient time-range queries per sensor and per water point
CREATE INDEX idx_sensor_readings_sensor_id   ON sensor_readings (sensor_id,      time DESC);
CREATE INDEX idx_sensor_readings_water_point ON sensor_readings (water_point_id, time DESC);
