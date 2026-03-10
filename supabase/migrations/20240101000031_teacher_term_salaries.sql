-- Migration 31: Per-term teacher salaries
-- Replaces single salary_amount per teacher with a per-term salary amount.
-- Salary is configured in the Terms page (expand term → Teacher Salaries).
-- Teacher salary payments now record which term they belong to.

-- ─────────────────────────────────────────────────────────────
-- STEP 1: New table — teacher salary per term
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_term_salaries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id)        ON DELETE RESTRICT,
  teacher_id    UUID NOT NULL REFERENCES teachers(id)       ON DELETE CASCADE,
  term_id       UUID NOT NULL REFERENCES academic_terms(id) ON DELETE RESTRICT,
  salary_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (salary_amount >= 0),
  UNIQUE(teacher_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_tts_teacher ON teacher_term_salaries(teacher_id);
CREATE INDEX IF NOT EXISTS idx_tts_term    ON teacher_term_salaries(term_id);
CREATE INDEX IF NOT EXISTS idx_tts_school  ON teacher_term_salaries(school_id);

ALTER TABLE teacher_term_salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON teacher_term_salaries
  USING (school_id = get_my_school_id());

-- ─────────────────────────────────────────────────────────────
-- STEP 2: Add term_id to teacher_salary_payments (nullable)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE teacher_salary_payments
  ADD COLUMN IF NOT EXISTS term_id UUID REFERENCES academic_terms(id);

CREATE INDEX IF NOT EXISTS idx_tsp_term ON teacher_salary_payments(term_id);

-- ─────────────────────────────────────────────────────────────
-- STEP 3: RPC to upsert a teacher's salary for a given term
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_teacher_term_salary(
  p_teacher_id  UUID,
  p_term_id     UUID,
  p_amount      NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO teacher_term_salaries(school_id, teacher_id, term_id, salary_amount)
  VALUES (get_my_school_id(), p_teacher_id, p_term_id, p_amount)
  ON CONFLICT(teacher_id, term_id)
  DO UPDATE SET salary_amount = EXCLUDED.salary_amount;
END;
$$;
