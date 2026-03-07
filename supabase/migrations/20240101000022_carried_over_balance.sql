-- Add carried_over_balance to students table.
-- This stores the net unpaid balance brought forward from a previous class at promotion time.
-- It accumulates: if a student is promoted multiple times with outstanding debt, it adds up.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS carried_over_balance NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Rebuild views: add carried_over_balance to fee calculations + restore term-aware payment
-- filtering (prevents old-term payments from double-counting against carryover).
-- The filter `WHERE at.id IS NULL OR p.term_id = at.id` is backward-compatible:
--   - No active term set → counts all payments (same as before this migration)
--   - Active term set    → counts only that term's payments (correct for carryover accounting)

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
  s.created_at                                                            AS admitted_at,
  s.parent_name,
  s.parent_phone,
  s.is_active,
  c.id                                                                    AS class_id,
  c.name                                                                  AS class_name,
  c.level                                                                 AS class_level,
  at.id                                                                   AS active_term_id,
  at.label                                                                AS active_term_label,
  c.term_fee_amount,
  COALESCE(s.discount_amount, 0)                                          AS discount_amount,
  COALESCE(s.carried_over_balance, 0)                                     AS carried_over_balance,
  -- total the student owes this term = class fee + arrears from old class - discount
  (
    c.term_fee_amount
    + COALESCE(s.carried_over_balance, 0)
    - COALESCE(s.discount_amount, 0)
  )                                                                       AS total_owed,
  -- payments counted only for the active term (or all if no term is active)
  COALESCE(SUM(p.amount_paid) FILTER (
    WHERE at.id IS NULL OR p.term_id = at.id
  ), 0)                                                                   AS total_paid,
  -- outstanding = what they owe minus what they paid this term
  GREATEST(0,
    c.term_fee_amount
    + COALESCE(s.carried_over_balance, 0)
    - COALESCE(s.discount_amount, 0)
    - COALESCE(SUM(p.amount_paid) FILTER (
        WHERE at.id IS NULL OR p.term_id = at.id
      ), 0)
  )                                                                       AS outstanding
FROM students s
LEFT JOIN classes c          ON s.class_id = c.id
LEFT JOIN academic_terms at  ON at.school_id = s.school_id AND at.is_active = true
LEFT JOIN payments p         ON p.student_id = s.id
GROUP BY
  s.id, s.school_id, s.full_name, s.admission_number,
  s.gender, s.date_of_birth, s.created_at,
  s.parent_name, s.parent_phone, s.is_active,
  s.carried_over_balance,
  c.id, c.name, c.level, c.term_fee_amount,
  at.id, at.label,
  s.discount_amount;

CREATE VIEW school_revenue_summary AS
SELECT
  sfs.school_id,
  COUNT(DISTINCT sfs.id) FILTER (WHERE sfs.is_active)               AS total_active_students,
  COALESCE(SUM(sfs.total_owed)  FILTER (WHERE sfs.is_active), 0)    AS expected_revenue,
  COALESCE(SUM(sfs.total_paid)  FILTER (WHERE sfs.is_active), 0)    AS collected_revenue,
  COALESCE(SUM(sfs.outstanding) FILTER (WHERE sfs.is_active), 0)    AS outstanding_revenue,
  COUNT(DISTINCT sfs.id) FILTER (WHERE sfs.outstanding > 0 AND sfs.is_active) AS defaulters_count
FROM student_fee_summary sfs
GROUP BY sfs.school_id;

-- RPC: atomically promote one or more students, snapshotting their current outstanding
-- into carried_over_balance before moving them to the target class.
-- Works for both single (student details page) and batch (classes page) promotions.
CREATE OR REPLACE FUNCTION promote_students(
  p_student_ids    UUID[],
  p_target_class_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- PostgreSQL snapshot isolation ensures sfs.outstanding is read from the
  -- pre-update state, so we safely capture each student's debt before the class change.
  UPDATE students s
  SET
    class_id             = p_target_class_id,
    carried_over_balance = s.carried_over_balance + COALESCE(sfs.outstanding, 0)
  FROM student_fee_summary sfs
  WHERE sfs.id = s.id
    AND s.id   = ANY(p_student_ids);
END;
$$;
