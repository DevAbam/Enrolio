CREATE TABLE schools (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  logo_url          TEXT,
  address           TEXT,
  phone             TEXT,
  email             TEXT,
  subscription_plan TEXT NOT NULL DEFAULT 'basic',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
