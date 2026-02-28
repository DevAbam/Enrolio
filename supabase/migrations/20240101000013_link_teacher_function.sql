-- Helper function to link a teacher row to an auth user + assign a class.
-- Called via supabase.rpc() from the API, which bypasses PostgREST's schema cache
-- so the function works immediately after migration 12 runs.
CREATE OR REPLACE FUNCTION link_teacher_to_user(
  p_teacher_id UUID,
  p_user_id    UUID,
  p_class_id   UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE teachers
  SET
    user_id  = p_user_id,
    class_id = p_class_id
  WHERE id = p_teacher_id;
END;
$$;
