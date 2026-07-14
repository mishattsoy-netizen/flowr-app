-- Create vault_accounts table
CREATE TABLE IF NOT EXISTS vault_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add account_id and key_index to vault table
ALTER TABLE vault ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES vault_accounts(id) ON DELETE CASCADE;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS key_index INTEGER DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vault_account_id ON vault(account_id);
CREATE INDEX IF NOT EXISTS idx_vault_accounts_provider ON vault_accounts(provider);

-- Add comment explaining the table
COMMENT ON TABLE vault_accounts IS 'Groups multiple keys into accounts for providers like Gemini, Groq, etc.';
