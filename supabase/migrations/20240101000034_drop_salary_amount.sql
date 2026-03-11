-- Migration 34: Remove salary_amount from teachers table
-- Salary is now managed per-term via teacher_term_salaries.
-- The set_teacher_salary RPC is also dropped as it is no longer used.

DROP FUNCTION IF EXISTS set_teacher_salary(UUID, NUMERIC);

ALTER TABLE teachers DROP COLUMN IF EXISTS salary_amount;
