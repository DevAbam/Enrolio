CREATE TABLE student_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date)
);
CREATE INDEX idx_student_att_school_id ON student_attendance(school_id);
CREATE INDEX idx_student_att_date      ON student_attendance(attendance_date);
CREATE INDEX idx_student_att_student   ON student_attendance(student_id);
