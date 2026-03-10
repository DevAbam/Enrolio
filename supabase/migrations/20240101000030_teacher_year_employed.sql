-- Migration 30: Add year_employed to teachers
-- Admin can explicitly set the year a teacher was employed.
-- Falls back to YEAR(created_at) in the UI when NULL.

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS year_employed INT;
