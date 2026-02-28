-- RPC to update teacher salary_amount, bypasses PostgREST schema cache
CREATE OR REPLACE FUNCTION set_teacher_salary(
  p_teacher_id   UUID,
  p_salary_amount NUMERIC
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE teachers
     SET salary_amount = p_salary_amount
   WHERE id = p_teacher_id
     AND school_id = get_my_school_id();
END;
$$;
