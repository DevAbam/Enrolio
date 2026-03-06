-- academic_terms: one active term per school at a time
CREATE TABLE academic_terms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  year         INT  NOT NULL,
  term_number  INT  NOT NULL CHECK (term_number >= 1),
  label        TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_one_active_term ON academic_terms(school_id) WHERE is_active = true;
CREATE INDEX idx_academic_terms_school ON academic_terms(school_id);

-- per-term fee override per class (overrides classes.term_fee_amount when set)
CREATE TABLE class_term_fees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES schools(id),
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  term_id    UUID NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  fee_amount NUMERIC(12,2) NOT NULL CHECK (fee_amount >= 0),
  UNIQUE(class_id, term_id)
);
CREATE INDEX idx_class_term_fees_term ON class_term_fees(term_id);

-- Tag payments and attendance with a term (nullable for legacy rows)
ALTER TABLE payments           ADD COLUMN IF NOT EXISTS term_id UUID REFERENCES academic_terms(id);
ALTER TABLE student_attendance ADD COLUMN IF NOT EXISTS term_id UUID REFERENCES academic_terms(id);
ALTER TABLE teacher_attendance ADD COLUMN IF NOT EXISTS term_id UUID REFERENCES academic_terms(id);

-- Single log per SMS activity regardless of recipient count (feature 11)
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS recipient_count INT NOT NULL DEFAULT 1;

-- Rebuild student_fee_summary to include DOB, admitted_at, and active-term-aware fee/payment totals
DROP VIEW IF EXISTS school_revenue_summary;
DROP VIEW IF EXISTS student_fee_summary;

CREATE VIEW student_fee_summary AS
SELECT
  s.id,
  s.school_id,
  s.full_name,
  s.admission_number,
  s.gender,
  s.parent_name,
  s.parent_phone,
  s.is_active,
  s.date_of_birth,
  s.created_at                                                               AS admitted_at,
  c.id                                                                       AS class_id,
  c.name                                                                     AS class_name,
  c.level                                                                    AS class_level,
  at.id                                                                      AS active_term_id,
  at.label                                                                   AS active_term_label,
  COALESCE(ctf.fee_amount, c.term_fee_amount)                                AS term_fee_amount,
  COALESCE(s.discount_amount, 0)                                             AS discount_amount,
  (COALESCE(ctf.fee_amount, c.term_fee_amount) - COALESCE(s.discount_amount, 0)) AS total_owed,
  COALESCE(SUM(p.amount_paid) FILTER (
    WHERE at.id IS NULL OR p.term_id = at.id
  ), 0)                                                                      AS total_paid,
  GREATEST(0,
    COALESCE(ctf.fee_amount, c.term_fee_amount)
    - COALESCE(s.discount_amount, 0)
    - COALESCE(SUM(p.amount_paid) FILTER (
        WHERE at.id IS NULL OR p.term_id = at.id
      ), 0)
  )                                                                          AS outstanding
FROM students s
LEFT JOIN classes c          ON s.class_id = c.id
LEFT JOIN academic_terms at  ON at.school_id = s.school_id AND at.is_active = true
LEFT JOIN class_term_fees ctf ON ctf.class_id = c.id AND ctf.term_id = at.id
LEFT JOIN payments p         ON p.student_id = s.id
GROUP BY
  s.id, s.school_id, s.full_name, s.admission_number, s.gender,
  s.parent_name, s.parent_phone, s.is_active, s.date_of_birth, s.created_at,
  c.id, c.name, c.level, c.term_fee_amount,
  at.id, at.label,
  ctf.fee_amount,
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

-- RLS
ALTER TABLE academic_terms  ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_term_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_isolation" ON academic_terms
  USING (school_id = get_my_school_id());
CREATE POLICY "school_isolation" ON class_term_fees
  USING (school_id = get_my_school_id());
