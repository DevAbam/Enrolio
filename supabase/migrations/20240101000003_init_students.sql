CREATE TABLE students (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  class_id         UUID REFERENCES classes(id) ON DELETE SET NULL,
  full_name        TEXT NOT NULL,
  admission_number TEXT,
  date_of_birth    DATE,
  gender           TEXT CHECK (gender IN ('male', 'female', 'other')),
  parent_name      TEXT,
  parent_phone     TEXT,
  parent_email     TEXT,
  discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_class_id  ON students(class_id);
