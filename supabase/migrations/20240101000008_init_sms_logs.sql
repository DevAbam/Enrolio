CREATE TABLE sms_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id        UUID REFERENCES students(id) ON DELETE SET NULL,
  sent_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  parent_phone      TEXT NOT NULL,
  message           TEXT NOT NULL,
  sms_type          TEXT NOT NULL DEFAULT 'fee_reminder'
                      CHECK (sms_type IN ('fee_reminder', 'general', 'bulk')),
  status            TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  provider_response TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sms_logs_school_id  ON sms_logs(school_id);
CREATE INDEX idx_sms_logs_student_id ON sms_logs(student_id);
CREATE INDEX idx_sms_logs_sent_at    ON sms_logs(sent_at);
