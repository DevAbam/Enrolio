-- Migration 32: Add staff_type to teachers table
-- Distinguishes teaching staff from non-teaching staff (e.g. cleaners, accountants, security).
-- All existing records default to 'teaching'.

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS staff_type TEXT NOT NULL DEFAULT 'teaching'
    CHECK (staff_type IN ('teaching', 'non_teaching'));

CREATE INDEX IF NOT EXISTS idx_teachers_staff_type ON teachers(staff_type);
