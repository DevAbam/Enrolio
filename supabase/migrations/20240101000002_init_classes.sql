CREATE TABLE classes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name             TEXT NOT NULL,
  term_fee_amount  NUMERIC(12,2) NOT NULL CHECK (term_fee_amount >= 0),
  academic_year    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
CREATE INDEX idx_classes_school_id ON classes(school_id);
