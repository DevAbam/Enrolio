-- Link teachers to auth users and assign them a class
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES users(id)   ON DELETE SET NULL;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teachers_user_id  ON teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_teachers_class_id ON teachers(class_id);
