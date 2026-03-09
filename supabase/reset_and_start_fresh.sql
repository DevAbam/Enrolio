-- ════════════════════════════════════════════════════════════════
-- RESET SCRIPT — Drops everything and lets you re-run all migrations
-- Run this in Supabase SQL Editor, then re-run all migrations 00→26
-- WARNING: All data will be permanently deleted.
-- ════════════════════════════════════════════════════════════════

-- 1. Drop views first (they depend on tables)
DROP VIEW IF EXISTS school_revenue_summary CASCADE;
DROP VIEW IF EXISTS student_fee_summary CASCADE;

-- 2. Drop functions / RPCs
DROP FUNCTION IF EXISTS promote_students(UUID[], UUID) CASCADE;
DROP FUNCTION IF EXISTS graduate_students(UUID[]) CASCADE;
DROP FUNCTION IF EXISTS enroll_student(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS activate_term_with_carryover(UUID) CASCADE;
DROP FUNCTION IF EXISTS deduct_sms_credits(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS add_sms_credits(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS set_teacher_salary(UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS link_teacher_to_user(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_my_school_id() CASCADE;
DROP FUNCTION IF EXISTS handle_updated_at() CASCADE;

-- 3. Drop tables (children before parents)
DROP TABLE IF EXISTS student_enrollments       CASCADE;
DROP TABLE IF EXISTS sms_credit_purchases      CASCADE;
DROP TABLE IF EXISTS sms_credit_transactions   CASCADE;
DROP TABLE IF EXISTS sms_logs                  CASCADE;
DROP TABLE IF EXISTS teacher_salary_payments   CASCADE;
DROP TABLE IF EXISTS teacher_attendance        CASCADE;
DROP TABLE IF EXISTS student_attendance        CASCADE;
DROP TABLE IF EXISTS payments                  CASCADE;
DROP TABLE IF EXISTS class_term_fees           CASCADE;
DROP TABLE IF EXISTS academic_terms            CASCADE;
DROP TABLE IF EXISTS teachers                  CASCADE;
DROP TABLE IF EXISTS students                  CASCADE;
DROP TABLE IF EXISTS classes                   CASCADE;
DROP TABLE IF EXISTS users                     CASCADE;
DROP TABLE IF EXISTS schools                   CASCADE;

-- Done. Now re-run all migration files 00 through 26 in order.
