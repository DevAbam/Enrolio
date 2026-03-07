-- RPC: activate_term_with_carryover
-- Called when admin sets a new term as active.
-- Before switching the active term, any student with an outstanding balance in the
-- current active term has that amount added to their carried_over_balance.
-- This ensures debt is never silently lost when a new term begins.

CREATE OR REPLACE FUNCTION activate_term_with_carryover(p_new_term_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  -- Resolve school from the term being activated
  SELECT school_id INTO v_school_id
  FROM academic_terms
  WHERE id = p_new_term_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Term not found: %', p_new_term_id;
  END IF;

  -- Snapshot each active student's current outstanding into carried_over_balance
  -- before the active term changes (so the view still uses the old active term).
  UPDATE students s
  SET carried_over_balance = s.carried_over_balance + COALESCE(sfs.outstanding, 0)
  FROM student_fee_summary sfs
  WHERE sfs.id      = s.id
    AND s.school_id = v_school_id
    AND s.is_active = true
    AND COALESCE(sfs.outstanding, 0) > 0;

  -- Switch the active term: deactivate all, then activate the new one.
  UPDATE academic_terms SET is_active = false WHERE school_id = v_school_id;
  UPDATE academic_terms SET is_active = true  WHERE id = p_new_term_id;
END;
$$;
