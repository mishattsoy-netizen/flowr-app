-- Telegram delivers a multi-photo "album" as N separate webhook invocations
-- sharing a media_group_id, with no shared process memory between them
-- (each is its own serverless invocation on Vercel). This table is the
-- coordination point: every invocation for the same album appends its
-- file_id here; after a short settle window, exactly one invocation wins
-- an atomic claim and processes the whole batch. See spec §5d bug 1.
create table if not exists telegram_media_groups (
  media_group_id text primary key,
  chat_id text not null,
  file_ids jsonb not null default '[]'::jsonb,
  caption text,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS is not needed here — this table is only ever touched by the webhook
-- route using supabaseAdmin (service role), never from the client.
alter table telegram_media_groups enable row level security;
-- No policies added: service-role key bypasses RLS entirely; this blocks
-- any accidental anon/authenticated access.
