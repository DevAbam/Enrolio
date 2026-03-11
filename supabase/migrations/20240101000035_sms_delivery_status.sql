-- Migration 35: SMS delivery status tracking
-- Store Arkesel message IDs so we can poll for real delivery status.
-- Expand status and sms_type constraints to cover all used values.

-- Store comma-separated Arkesel message IDs for status lookup
ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS arkesel_msg_ids TEXT;

-- Drop and recreate the status constraint to allow Arkesel delivery statuses
ALTER TABLE sms_logs DROP CONSTRAINT IF EXISTS sms_logs_status_check;
ALTER TABLE sms_logs ADD CONSTRAINT sms_logs_status_check
  CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'partial', 'success'));

-- Also allow 'broadcast' sms_type (it was missing from the original constraint)
ALTER TABLE sms_logs DROP CONSTRAINT IF EXISTS sms_logs_sms_type_check;
ALTER TABLE sms_logs ADD CONSTRAINT sms_logs_sms_type_check
  CHECK (sms_type IN ('fee_reminder', 'general', 'bulk', 'broadcast'));

-- Migrate legacy 'success' status to 'sent' so the column is consistent
UPDATE sms_logs SET status = 'sent' WHERE status = 'success';
