-- Junction table that makes POST /reports/:id/upvote idempotent.
-- One row per (report, user) pair — attempting to insert twice raises a PK conflict.

CREATE TABLE report_upvotes (
  report_id  UUID        NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users   (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (report_id, user_id)
);
