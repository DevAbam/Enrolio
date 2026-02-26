CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  amount_paid    NUMERIC(12,2) NOT NULL CHECK (amount_paid > 0),
  payment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'momo', 'card', 'other')),
  receipt_number TEXT,
  recorded_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, receipt_number)
);
CREATE INDEX idx_payments_school_id  ON payments(school_id);
CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_date       ON payments(payment_date);
