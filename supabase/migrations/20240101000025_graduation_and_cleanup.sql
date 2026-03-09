-- Migration 25: Graduation support + remove academic_year from classes
-- 1. Remove the academic_year field from classes (it was never functionally used; terms already
--    carry year context via academic_terms.year).
-- 2. Add is_graduated + graduated_at to students for graduation tracking.
-- 3. Create graduate_students() RPC that marks students as graduated.
-- 4. Rebuild views to expose is_graduated.

-- ───────────────────────────────────────────────────────────────
-- 1. Remove academic_year from classes (data migration: already TEXT, nullable, safe to drop)
-- ───────────────────────────────────────────────────────────────
ALTER TABLE classes DROP COLUMN IF EXISTS academic_year;

-- ───────────────────────────────────────────────────────────────
-- 2. Add graduation fields to students
-- ───────────────────────────────────────────────────────────────
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_graduated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMPTZ;

-- ───────────────────────────────────────────────────────────────
-- 3. graduate_students() RPC
--    Snapshots the current outstanding balance into carried_over_balance (for record-keeping),
--    marks is_graduated = true, sets graduated_at, and deactivates the student.
--    Graduated students retain their full history (payments, attendance, etc.)
--    but are excluded from active class lists, attendance screens, and fee calculations.
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION graduate_students(p_student_ids UUID[])
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE students s
  SET
    is_graduated         = true,
    graduated_at         = now(),
    is_active            = false,
    carried_over_balance = s.carried_over_balance + COALESCE(
      (SELECT outstanding FROM student_fee_summary sfs WHERE sfs.id = s.id),
      0
    )
  WHERE s.id = ANY(p_student_ids)
    AND s.is_graduated = false;
END;
$$;

-- ───────────────────────────────────────────────────────────────
-- 4. Rebuild student_fee_summary to expose is_graduated
--    (outstanding & active-term fee logic unchanged)
-- ───────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS school_revenue_summary;
DROP VIEW IF EXISTS student_fee_summary;

CREATE VIEW student_fee_summary AS
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
  -- Use class_term_fees override if it exists for the active term, else fall back to class default
  COALESCE(ctf.fee_amount, c.term_fee_amount)                             AS term_fee_amount,
  COALESCE(s.discount_amount, 0)                                          AS discount_amount,
  COALESCE(s.carried_over_balance, 0)                                     AS carried_over_balance,
  (
    COALESCE(ctf.fee_amount, c.term_fee_amount)
    + COALESCE(s.carried_over_balance, 0)
    - COALESCE(s.discount_amount, 0)
  )                                                                       AS total_owed,
  -- Payments counted only for the active term (or all if no term is active)
  COALESCE(SUM(p.amount_paid) FILTER (
    WHERE at.id IS NULL OR p.term_id = at.id
  ), 0)                                                                   AS total_paid,
  GREATEST(0,
    COALESCE(ctf.fee_amount, c.term_fee_amount)
    + COALESCE(s.carried_over_balance, 0)
    - COALESCE(s.discount_amount, 0)
    - COALESCE(SUM(p.amount_paid) FILTER (
        WHERE at.id IS NULL OR p.term_id = at.id
      ), 0)
  )                                                                       AS outstanding
FROM students s
LEFT JOIN classes c          ON s.class_id = c.id
LEFT JOIN academic_terms at  ON at.school_id = s.school_id AND at.is_active = true
LEFT JOIN class_term_fees ctf ON ctf.class_id = c.id AND ctf.term_id = at.id
LEFT JOIN payments p         ON p.student_id = s.id
GROUP BY
  s.id, s.school_id, s.full_name, s.admission_number,
  s.gender, s.date_of_birth, s.photo_url, s.created_at,
  s.parent_name, s.parent_phone, s.is_active, s.is_graduated, s.graduated_at,
  s.carried_over_balance,
  c.id, c.name, c.level, c.term_fee_amount,
  at.id, at.label,
  ctf.fee_amount,
  s.discount_amount;

CREATE VIEW school_revenue_summary AS
SELECT
  sfs.school_id,
  -- Only count non-graduated active students in revenue summaries
  COUNT(DISTINCT sfs.id) FILTER (WHERE sfs.is_active AND NOT sfs.is_graduated)  AS total_active_students,
  COALESCE(SUM(sfs.total_owed)  FILTER (WHERE sfs.is_active AND NOT sfs.is_graduated), 0) AS expected_revenue,
  COALESCE(SUM(sfs.total_paid)  FILTER (WHERE sfs.is_active AND NOT sfs.is_graduated), 0) AS collected_revenue,
  COALESCE(SUM(sfs.outstanding) FILTER (WHERE sfs.is_active AND NOT sfs.is_graduated), 0) AS outstanding_revenue,
  COUNT(DISTINCT sfs.id) FILTER (WHERE sfs.outstanding > 0 AND sfs.is_active AND NOT sfs.is_graduated) AS defaulters_count
FROM student_fee_summary sfs
GROUP BY sfs.school_id;
