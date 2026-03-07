-- Add photo_url to students and teachers (stored as ImageKit CDN URL)
ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add date_of_birth to teachers (for birthday reminders)
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add logo_url to schools (already in type definition, ensure it exists)
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Rebuild student_fee_summary to include photo_url
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
  c.id                                                                    AS class_id,
  c.name                                                                  AS class_name,
  c.level                                                                 AS class_level,
  at.id                                                                   AS active_term_id,
  at.label                                                                AS active_term_label,
  c.term_fee_amount,
  COALESCE(s.discount_amount, 0)                                          AS discount_amount,
  COALESCE(s.carried_over_balance, 0)                                     AS carried_over_balance,
  (
    c.term_fee_amount
    + COALESCE(s.carried_over_balance, 0)
    - COALESCE(s.discount_amount, 0)
  )                                                                       AS total_owed,
  COALESCE(SUM(p.amount_paid) FILTER (
    WHERE at.id IS NULL OR p.term_id = at.id
  ), 0)                                                                   AS total_paid,
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
  s.gender, s.date_of_birth, s.photo_url, s.created_at,
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
