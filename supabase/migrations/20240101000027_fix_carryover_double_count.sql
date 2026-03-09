-- Migration 27: Fix carried_over_balance double-counting bug
--
-- ROOT CAUSE:
--   The student_fee_summary view computes outstanding as:
--     outstanding = term_fee + carried_over_balance - payments
--
--   Both activate_term_with_carryover() and promote_students() were doing:
--     carried_over_balance = carried_over_balance + outstanding
--
--   Since `outstanding` already includes `carried_over_balance`, this
--   double-counts the existing carryover on every term activation or promotion.
--
-- EXAMPLE OF THE BUG:
--   Term 1: fee=100, paid=50  → outstanding=50
--   Activate Term 2: carried_over = 0 + 50 = 50           ✓ (first activation is fine)
--   Term 2: fee=200           → outstanding = 200+50 = 250
--   Activate Term 3: carried_over = 50 + 250 = 300         ✗ (should be 250)
--   (The 50 from Term 1 was counted again inside the 250 outstanding)
--
-- FIX:
--   Set carried_over_balance = outstanding  (not += outstanding)
--   Because outstanding already contains the full historical debt.

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix activate_term_with_carryover()
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION activate_term_with_carryover(p_new_term_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  SELECT school_id INTO v_school_id
  FROM academic_terms WHERE id = p_new_term_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Term not found: %', p_new_term_id;
  END IF;

  -- Snapshot each active student's FULL outstanding balance into carried_over_balance.
  -- Use SET (=) not accumulate (+=) because sfs.outstanding already includes
  -- any existing carried_over_balance — adding it again would double-count.
  UPDATE students s
  SET carried_over_balance = COALESCE(sfs.outstanding, 0)
  FROM student_fee_summary sfs
  WHERE sfs.id      = s.id
    AND s.school_id = v_school_id
    AND s.is_active = true
    AND NOT s.is_graduated
    AND COALESCE(sfs.outstanding, 0) > 0;

  -- Switch the active term
  UPDATE academic_terms SET is_active = false WHERE school_id = v_school_id;
  UPDATE academic_terms SET is_active = true  WHERE id = p_new_term_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix promote_students()
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION promote_students(
  p_student_ids     UUID[],
  p_target_class_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_id      UUID;
  v_active_term_id UUID;
BEGIN
  SELECT school_id INTO v_school_id FROM classes WHERE id = p_target_class_id;
  SELECT id INTO v_active_term_id FROM academic_terms
  WHERE school_id = v_school_id AND is_active = true;

  -- Snapshot the student's full outstanding as the new carried_over_balance.
  -- Again SET (=) not += because outstanding already includes the old carryover.
  UPDATE students s
  SET
    class_id             = p_target_class_id,
    carried_over_balance = COALESCE(sfs.outstanding, 0)
  FROM student_fee_summary sfs
  WHERE sfs.id = s.id
    AND s.id   = ANY(p_student_ids);

  -- Create/update enrollment record for the active term
  IF v_active_term_id IS NOT NULL THEN
    INSERT INTO student_enrollments (school_id, student_id, class_id, term_id)
    SELECT v_school_id, unnest(p_student_ids), p_target_class_id, v_active_term_id
    ON CONFLICT (student_id, term_id) DO UPDATE SET class_id = EXCLUDED.class_id;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix graduate_students() — same issue
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION graduate_students(p_student_ids UUID[])
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE students s
  SET
    is_graduated         = true,
    graduated_at         = now(),
    is_active            = false,
    carried_over_balance = COALESCE(
      (SELECT outstanding FROM student_fee_summary sfs WHERE sfs.id = s.id),
      0
    )
  WHERE s.id = ANY(p_student_ids)
    AND s.is_graduated = false;
END;
$$;
