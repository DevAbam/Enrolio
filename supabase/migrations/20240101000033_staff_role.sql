-- Migration 33: Add staff_role to teachers table
-- Stores the role/position of non-teaching staff (e.g. driver, cook, cleaner, security).
-- NULL for teaching staff.

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS staff_role TEXT;
