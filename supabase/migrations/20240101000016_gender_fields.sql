-- Add gender column to teachers
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS gender TEXT
  CHECK (gender IN ('male', 'female', 'other'));

-- Rebuild student_fee_summary view to include gender
CREATE OR REPLACE VIEW student_fee_summary AS
SELECT
  s.id,
  s.school_id,
  s.full_name,
  s.admission_number,
  s.gender,
  s.parent_name,
  s.parent_phone,
  s.is_active,
  c.id                                                   AS class_id,
  c.name                                                 AS class_name,
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
  s.gender,
  s.parent_name, s.parent_phone, s.is_active,
  c.id, c.name, c.term_fee_amount, s.discount_amount;
