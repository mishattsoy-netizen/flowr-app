-- Run this entire file in Supabase Dashboard > SQL Editor

ALTER TABLE cost_log ADD COLUMN IF NOT EXISTS chain TEXT;
ALTER TABLE cost_log ADD COLUMN IF NOT EXISTS subprovider TEXT;
CREATE INDEX IF NOT EXISTS idx_cost_log_chain ON cost_log(chain);

-- Apply Data API access grants for security update compliance
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Beta gating tables
create table if not exists public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  label text not null,
  used_by_email text,
  used_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.beta_approved_users (
  email text primary key,
  approved_at timestamptz default now(),
  invite_token text not null references public.beta_invites(token)
);

alter table public.beta_invites enable row level security;
alter table public.beta_approved_users enable row level security;

-- Allow server-side reads (anon key) to check if a user is approved
create policy "Public read for approval check"
  on public.beta_approved_users for select
  using (true);
