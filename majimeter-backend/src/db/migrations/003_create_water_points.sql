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
-- Bounding-box geo queries: WHERE lat BETWEEN $1 AND $2 AND lng BETWEEN $3 AND $4
CREATE INDEX idx_water_points_location  ON water_points (location_lat, location_lng);

CREATE TRIGGER water_points_set_updated_at
  BEFORE UPDATE ON water_points
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
