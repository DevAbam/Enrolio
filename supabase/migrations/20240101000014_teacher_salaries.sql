-- Add salary amount to the teachers table
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS salary_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Teacher salary payments — immutable records (no DELETE RLS policy)
CREATE TABLE IF NOT EXISTS teacher_salary_payments (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID          NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  teacher_id     UUID          NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  amount_paid    NUMERIC(10,2) NOT NULL CHECK (amount_paid > 0),
  payment_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  period_label   TEXT,                   -- e.g. "January 2026", "Term 1 2026"
  payment_method TEXT          NOT NULL DEFAULT 'cash'
                               CHECK (payment_method IN ('cash', 'bank_transfer', 'mobile_money', 'cheque')),
  notes          TEXT,
  paid_by        UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_salary_payments_teacher ON teacher_salary_payments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_salary_payments_school  ON teacher_salary_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_salary_payments_date    ON teacher_salary_payments(payment_date);

-- Reuse the existing updated_at trigger function
CREATE TRIGGER set_teacher_salary_payments_updated_at
  BEFORE UPDATE ON teacher_salary_payments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- RLS
ALTER TABLE teacher_salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_isolation_teacher_salary_payments"
  ON teacher_salary_payments
  USING (school_id = get_my_school_id());

CREATE POLICY "insert_teacher_salary_payments"
  ON teacher_salary_payments FOR INSERT
  WITH CHECK (school_id = get_my_school_id());
