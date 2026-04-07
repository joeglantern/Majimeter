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
-- Fast query for "all unacknowledged alerts"
CREATE INDEX idx_alerts_unacknowledged ON alerts (triggered_at DESC)
  WHERE acknowledged_at IS NULL;
