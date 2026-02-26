CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT school_id FROM users WHERE id = auth.uid();
$$;

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY schools_select ON schools FOR SELECT USING (id = get_my_school_id());
CREATE POLICY schools_update ON schools FOR UPDATE USING (id = get_my_school_id());

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_select ON users FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (school_id = get_my_school_id());
CREATE POLICY users_update ON users FOR UPDATE USING (school_id = get_my_school_id());

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY classes_select ON classes FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY classes_insert ON classes FOR INSERT WITH CHECK (school_id = get_my_school_id());
CREATE POLICY classes_update ON classes FOR UPDATE USING (school_id = get_my_school_id());
CREATE POLICY classes_delete ON classes FOR DELETE USING (school_id = get_my_school_id());

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY students_select ON students FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY students_insert ON students FOR INSERT WITH CHECK (school_id = get_my_school_id());
CREATE POLICY students_update ON students FOR UPDATE USING (school_id = get_my_school_id());

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY teachers_select ON teachers FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY teachers_insert ON teachers FOR INSERT WITH CHECK (school_id = get_my_school_id());
CREATE POLICY teachers_update ON teachers FOR UPDATE USING (school_id = get_my_school_id());

-- No delete policy on payments — they are immutable
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_select ON payments FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK (school_id = get_my_school_id());

ALTER TABLE student_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_att_select ON student_attendance FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY student_att_insert ON student_attendance FOR INSERT WITH CHECK (school_id = get_my_school_id());
CREATE POLICY student_att_update ON student_attendance FOR UPDATE USING (school_id = get_my_school_id());

ALTER TABLE teacher_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY teacher_att_select ON teacher_attendance FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY teacher_att_insert ON teacher_attendance FOR INSERT WITH CHECK (school_id = get_my_school_id());
CREATE POLICY teacher_att_update ON teacher_attendance FOR UPDATE USING (school_id = get_my_school_id());

-- Append-only SMS logs
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sms_logs_select ON sms_logs FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY sms_logs_insert ON sms_logs FOR INSERT WITH CHECK (school_id = get_my_school_id());

-- Note: VIEW ownership is not changed — RLS is enforced on underlying tables via get_my_school_id()
-- Supabase restricts ALTER VIEW ... OWNER TO in the SQL editor
