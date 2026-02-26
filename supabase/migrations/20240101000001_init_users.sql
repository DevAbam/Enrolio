CREATE TABLE users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  full_name  TEXT,
  role       TEXT NOT NULL DEFAULT 'admin'
               CHECK (role IN ('admin', 'accountant', 'teacher', 'receptionist')),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_school_id ON users(school_id);
