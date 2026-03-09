-- Migration 26: Student Enrollment Tracking + Fee Refactor
--
-- Points addressed: 1, 3, 4, 5, 7
--   1. Classes no longer store fee amounts (term_fee_amount removed)
--   3. Fees defined ONLY via class_term_fees per class per term
--   4. student_enrollments tracks class per term
--   5. Fee calculation uses enrollment + class_term_fees
--   7. promote_students() creates enrollment records

-- ───────────────────────────────────────────────────────────────
-- STEP 1: Drop all views that depend on classes.term_fee_amount
--         MUST happen before we alter/drop the column.
-- ───────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS school_revenue_summary;
DROP VIEW IF EXISTS student_fee_summary;

-- ───────────────────────────────────────────────────────────────
-- STEP 2: Remove term_fee_amount from classes
--         Fees live exclusively in class_term_fees from this point.
-- ───────────────────────────────────────────────────────────────
ALTER TABLE classes DROP COLUMN IF EXISTS term_fee_amount;

-- ───────────────────────────────────────────────────────────────
-- STEP 3: Create student_enrollments table
--         One row per student per term — the canonical record of
--         which class a student was in during a given term.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id)        ON DELETE RESTRICT,
  student_id  UUID NOT NULL REFERENCES students(id)       ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES classes(id)        ON DELETE RESTRICT,
  term_id     UUID NOT NULL REFERENCES academic_terms(id) ON DELETE RESTRICT,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, term_id)
);
CREATE INDEX IF NOT EXISTS idx_se_student ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_se_term    ON student_enrollments(term_id);
CREATE INDEX IF NOT EXISTS idx_se_class   ON student_enrollments(class_id);

ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON student_enrollments
  USING (school_id = get_my_school_id());

-- ───────────────────────────────────────────────────────────────
-- STEP 4: Rebuild student_fee_summary
--         Class resolved via: enrollment for active term → students.class_id fallback
--         Fee resolved via: class_term_fees for active term only (0 if not set)
-- ───────────────────────────────────────────────────────────────
CREATE VIEW student_fee_summary AS
WITH active_enrollment AS (
  SELECT se.student_id, se.class_id
  FROM   student_enrollments se
  JOIN   academic_terms      at ON se.term_id = at.id AND at.is_active = true
)
SELECT
  s.id,
  s.school_id,
  s.full_name,
  s.admission_number,
  s.gender,
  s.date_of_birth,
  s.photo_url,
  s.created_at                                                            AS admitted_at,
  s.parent_name,
  s.parent_phone,
  s.is_active,
  s.is_graduated,
  s.graduated_at,
  c.id                                                                    AS class_id,
  c.name                                                                  AS class_name,
  c.level                                                                 AS class_level,
  at.id                                                                   AS active_term_id,
  at.label                                                                AS active_term_label,
  COALESCE(ctf.fee_amount, 0)                                             AS term_fee_amount,
  COALESCE(s.discount_amount, 0)                                          AS discount_amount,
  COALESCE(s.carried_over_balance, 0)                                     AS carried_over_balance,
  (
    COALESCE(ctf.fee_amount, 0)
    + COALESCE(s.carried_over_balance, 0)
    - COALESCE(s.discount_amount, 0)
  )                                                                       AS total_owed,
  COALESCE(SUM(p.amount_paid) FILTER (
    WHERE at.id IS NULL OR p.term_id = at.id
  ), 0)                                                                   AS total_paid,
  GREATEST(0,
    COALESCE(ctf.fee_amount, 0)
    + COALESCE(s.carried_over_balance, 0)
    - COALESCE(s.discount_amount, 0)
    - COALESCE(SUM(p.amount_paid) FILTER (
        WHERE at.id IS NULL OR p.term_id = at.id
      ), 0)
  )                                                                       AS outstanding
FROM students s
LEFT JOIN active_enrollment ae  ON ae.student_id = s.id
LEFT JOIN classes c             ON c.id = COALESCE(ae.class_id, s.class_id)
LEFT JOIN academic_terms at     ON at.school_id = s.school_id AND at.is_active = true
LEFT JOIN class_term_fees ctf   ON ctf.class_id = c.id AND ctf.term_id = at.id
LEFT JOIN payments p            ON p.student_id = s.id
GROUP BY
  s.id, s.school_id, s.full_name, s.admission_number,
  s.gender, s.date_of_birth, s.photo_url, s.created_at,
  s.parent_name, s.parent_phone, s.is_active, s.is_graduated, s.graduated_at,
  s.carried_over_balance,
  c.id, c.name, c.level,
  at.id, at.label,
  ctf.fee_amount,
  s.discount_amount;

CREATE VIEW school_revenue_summary AS
SELECT
  sfs.school_id,
  COUNT(DISTINCT sfs.id) FILTER (WHERE sfs.is_active AND NOT sfs.is_graduated)               AS total_active_students,
  COALESCE(SUM(sfs.total_owed)  FILTER (WHERE sfs.is_active AND NOT sfs.is_graduated), 0)    AS expected_revenue,
  COALESCE(SUM(sfs.total_paid)  FILTER (WHERE sfs.is_active AND NOT sfs.is_graduated), 0)    AS collected_revenue,
  COALESCE(SUM(sfs.outstanding) FILTER (WHERE sfs.is_active AND NOT sfs.is_graduated), 0)    AS outstanding_revenue,
  COUNT(DISTINCT sfs.id) FILTER (WHERE sfs.outstanding > 0 AND sfs.is_active AND NOT sfs.is_graduated) AS defaulters_count
FROM student_fee_summary sfs
GROUP BY sfs.school_id;

-- ───────────────────────────────────────────────────────────────
-- STEP 5: Update promote_students() — creates enrollment record + updates class_id
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION promote_students(
  p_student_ids     UUID[],
  p_target_class_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_id      UUID;
  v_active_term_id UUID;
BEGIN
  SELECT school_id INTO v_school_id FROM classes WHERE id = p_target_class_id;
  SELECT id INTO v_active_term_id FROM academic_terms WHERE school_id = v_school_id AND is_active = true;

  -- Snapshot outstanding before moving (uses view which still sees old class)
  UPDATE students s
  SET
    class_id             = p_target_class_id,
    carried_over_balance = s.carried_over_balance + COALESCE(sfs.outstanding, 0)
  FROM student_fee_summary sfs
  WHERE sfs.id = s.id AND s.id = ANY(p_student_ids);

  -- Create/update enrollment record for the active term
  IF v_active_term_id IS NOT NULL THEN
    INSERT INTO student_enrollments (school_id, student_id, class_id, term_id)
    SELECT v_school_id, unnest(p_student_ids), p_target_class_id, v_active_term_id
    ON CONFLICT (student_id, term_id) DO UPDATE SET class_id = EXCLUDED.class_id;
  END IF;
END;
$$;

-- ───────────────────────────────────────────────────────────────
-- STEP 6: enroll_student() helper — for new student class assignment
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enroll_student(p_student_id UUID, p_class_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_id UUID; v_active_term_id UUID;
BEGIN
  SELECT school_id INTO v_school_id FROM students WHERE id = p_student_id;
  UPDATE students SET class_id = p_class_id WHERE id = p_student_id;
  SELECT id INTO v_active_term_id FROM academic_terms WHERE school_id = v_school_id AND is_active = true;
  IF v_active_term_id IS NOT NULL THEN
    INSERT INTO student_enrollments (school_id, student_id, class_id, term_id)
    VALUES (v_school_id, p_student_id, p_class_id, v_active_term_id)
    ON CONFLICT (student_id, term_id) DO UPDATE SET class_id = EXCLUDED.class_id;
  END IF;
END;
$$;
