-- Add class_level, gender, date_of_birth, admitted_at to student_fee_summary.
-- Must DROP and recreate because PostgreSQL's CREATE OR REPLACE VIEW
-- cannot add columns in the middle of an existing column list.
-- school_revenue_summary depends on student_fee_summary so it must be
-- dropped and recreated too.

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
  s.created_at                                           AS admitted_at,
  s.parent_name,
  s.parent_phone,
  s.is_active,
  c.id                                                   AS class_id,
  c.name                                                 AS class_name,
  c.level                                                AS class_level,
  c.term_fee_amount,
  COALESCE(s.discount_amount, 0)                         AS discount_amount,
  (c.term_fee_amount - COALESCE(s.discount_amount, 0))   AS total_owed,
  COALESCE(SUM(p.amount_paid), 0)                        AS total_paid,
  GREATEST(0,
    c.term_fee_amount
    - COALESCE(s.discount_amount, 0)
    - COALESCE(SUM(p.amount_paid), 0)
  )                                                      AS outstanding
FROM students s
LEFT JOIN classes c ON s.class_id = c.id
LEFT JOIN payments p ON p.student_id = s.id
GROUP BY
  s.id, s.school_id, s.full_name, s.admission_number,
  s.gender, s.date_of_birth, s.created_at,
  s.parent_name, s.parent_phone, s.is_active,
  c.id, c.name, c.level, c.term_fee_amount, s.discount_amount;

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
