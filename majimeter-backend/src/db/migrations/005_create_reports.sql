CREATE TABLE reports (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  water_point_id UUID          REFERENCES water_points (id) ON DELETE SET NULL,
  type           report_type   NOT NULL,
  title          VARCHAR(255)  NOT NULL,
  description    TEXT,
  location_lat   DECIMAL(10, 8) NOT NULL,
  location_lng   DECIMAL(11, 8) NOT NULL,
  images         TEXT[]        NOT NULL DEFAULT '{}',   -- Supabase Storage public URLs
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
