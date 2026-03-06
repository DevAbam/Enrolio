-- Add SMS credit balance to each school (1 credit = 1 SMS)
ALTER TABLE schools ADD COLUMN IF NOT EXISTS sms_credits INTEGER NOT NULL DEFAULT 0;

-- Log of all recharges and deductions
CREATE TABLE IF NOT EXISTS sms_credit_transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID        NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  amount      INTEGER     NOT NULL,                                  -- positive = recharge, negative = deduction
  type        TEXT        NOT NULL CHECK (type IN ('recharge', 'deduction')),
  description TEXT,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_credit_tx_school ON sms_credit_transactions(school_id);

ALTER TABLE sms_credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sms_credit_tx_select ON sms_credit_transactions FOR SELECT USING (school_id = get_my_school_id());
CREATE POLICY sms_credit_tx_insert ON sms_credit_transactions FOR INSERT WITH CHECK (school_id = get_my_school_id());

-- Fix sms_logs sms_type constraint to include 'broadcast' (was missing, 'notice' was wrongly used)
ALTER TABLE sms_logs DROP CONSTRAINT IF EXISTS sms_logs_sms_type_check;
ALTER TABLE sms_logs ADD CONSTRAINT sms_logs_sms_type_check
  CHECK (sms_type IN ('fee_reminder', 'general', 'bulk', 'broadcast'));

-- Add recipient_count column if it doesn't exist (used by the API route)
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS recipient_count INTEGER NOT NULL DEFAULT 1;

-- Atomic function: deduct sms_credits, prevent going below 0
CREATE OR REPLACE FUNCTION deduct_sms_credits(p_school_id UUID, p_amount INTEGER)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE schools
  SET sms_credits = GREATEST(0, sms_credits - p_amount)
  WHERE id = p_school_id;
END;
$$;

-- Atomic function: add sms_credits (for recharge)
CREATE OR REPLACE FUNCTION add_sms_credits(p_school_id UUID, p_amount INTEGER)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE schools
  SET sms_credits = sms_credits + p_amount
  WHERE id = p_school_id;
END;
$$;
