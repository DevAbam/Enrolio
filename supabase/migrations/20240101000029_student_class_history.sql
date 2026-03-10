-- Migration 29: Student class movement history
-- Track every time a student is promoted or demoted between classes.

CREATE TABLE IF NOT EXISTS student_class_history (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        UUID         NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id       UUID         NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_class_id    UUID         REFERENCES classes(id) ON DELETE SET NULL,
  from_class_name  TEXT,
  to_class_id      UUID         REFERENCES classes(id) ON DELETE SET NULL,
  to_class_name    TEXT,
  action           TEXT         NOT NULL CHECK (action IN ('promoted', 'demoted', 'enrolled')),
  term_id          UUID         REFERENCES academic_terms(id) ON DELETE SET NULL,
  term_label       TEXT,
  changed_by       UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Index for fast per-student lookups
CREATE INDEX IF NOT EXISTS student_class_history_student_idx ON student_class_history(student_id);

-- RLS: same school can see own records
ALTER TABLE student_class_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school members can manage class history"
  ON student_class_history
  FOR ALL
  USING (school_id = (SELECT s.school_id FROM users s WHERE s.id = auth.uid()))
  WITH CHECK (school_id = (SELECT s.school_id FROM users s WHERE s.id = auth.uid()));
