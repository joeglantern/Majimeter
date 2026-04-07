CREATE TABLE notifications (
  id      UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID              NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title   VARCHAR(255)      NOT NULL,
  body    TEXT              NOT NULL,
  type    notification_type NOT NULL,
  ref_id  UUID,                            -- ID of the related alert or report
  read    BOOLEAN           NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications (user_id, sent_at DESC);
-- Fast unread badge count
CREATE INDEX idx_notifications_unread  ON notifications (user_id)
  WHERE read = false;
