-- Migration 28: Snapshot balance remaining at time of payment
--
-- Problem: receipts were showing the live outstanding balance from the
-- student_fee_summary view, which changes whenever a new payment is made.
-- Old receipts therefore show the wrong (current) balance instead of
-- what the balance was immediately after that specific payment was recorded.
--
-- Fix: add balance_after to payments so the balance at that moment is
-- permanently stored with the payment record and never changes.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS balance_after NUMERIC(12,2);

-- Existing rows get NULL — receipts for old payments will fall back to
-- showing "—" for balance remaining, which is honest (we don't know).
