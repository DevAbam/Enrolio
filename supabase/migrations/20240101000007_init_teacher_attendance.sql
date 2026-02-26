CREATE TABLE teacher_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  teacher_id      UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, attendance_date)
);
CREATE INDEX idx_teacher_att_school_id ON teacher_attendance(school_id);
CREATE INDEX idx_teacher_att_date      ON teacher_attendance(attendance_date);
