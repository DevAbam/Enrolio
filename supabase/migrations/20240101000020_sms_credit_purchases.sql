-- Tracks every Paystack payment attempt for SMS credit top-ups
CREATE TABLE IF NOT EXISTS sms_credit_purchases (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          UUID        NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  paystack_reference TEXT        NOT NULL UNIQUE,   -- idempotency anchor
  credits_purchased  INTEGER     NOT NULL,           -- credits to grant on success
  amount_pesewas     INTEGER     NOT NULL,           -- GHS amount × 100
  status             TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'success', 'failed')),
  initiated_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  verified_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_purchases_school ON sms_credit_purchases(school_id);
CREATE INDEX IF NOT EXISTS idx_sms_purchases_ref    ON sms_credit_purchases(paystack_reference);

ALTER TABLE sms_credit_purchases ENABLE ROW LEVEL SECURITY;

-- Schools can read their own purchases (for purchase history UI)
DROP POLICY IF EXISTS sms_purchases_select ON sms_credit_purchases;
CREATE POLICY sms_purchases_select ON sms_credit_purchases
  FOR SELECT USING (school_id = get_my_school_id());

-- Inserts come from the recharge API route (authenticated session)
DROP POLICY IF EXISTS sms_purchases_insert ON sms_credit_purchases;
CREATE POLICY sms_purchases_insert ON sms_credit_purchases
  FOR INSERT WITH CHECK (school_id = get_my_school_id());

-- UPDATE is intentionally absent from RLS.
-- Only the service-role client (webhook + verify routes) can transition status.
-- This prevents a school from self-approving their own purchase.

DROP TRIGGER IF EXISTS sms_purchases_updated_at ON sms_credit_purchases;
CREATE TRIGGER sms_purchases_updated_at
  BEFORE UPDATE ON sms_credit_purchases
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
