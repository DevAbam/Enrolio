-- Numeric level for class ordering (used for student promotion)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS level INT;

-- Last admin-assigned login password (stored at admin's discretion for reference)
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS temp_password TEXT;

-- General notes field for teacher records
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS notes TEXT;
