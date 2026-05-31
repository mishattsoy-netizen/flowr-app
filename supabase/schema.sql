-- ============================================================
-- Flowr 4.1 — Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- Enable UUID extension (already enabled on Supabase by default)
-- create extension if not exists "uuid-ossp";


-- ─── entities ────────────────────────────────────────────────
-- Stores notes, canvases, folders, and collections

create table if not exists entities (
  id           text        primary key,
  title        text        not null default '',
  type         text        not null,           -- 'note' | 'canvas' | 'folder' | 'collection' | 'mixed'
  parent_id    text        references entities(id) on delete cascade,
  last_modified bigint     not null default 0,
  icon         text,
  tags         text[]      default '{}',
  content      jsonb       default '[]',       -- EditorBlock[]
  created_at   timestamptz not null default now()
);

create index if not exists entities_parent_id_idx on entities(parent_id);
create index if not exists entities_type_idx      on entities(type);


-- ─── tasks ───────────────────────────────────────────────────

create table if not exists tasks (
  id          text        primary key,
  title       text        not null default '',
  completed   boolean     not null default false,
  due_date    text,                             -- 'YYYY-MM-DD'
  entity_id   text        references entities(id) on delete set null,
  note        text,
  color       text,
  priority    text        check (priority in ('low', 'medium', 'high')),
  difficulty  integer,
  status      text        check (status in ('todo', 'in-progress', 'done')),
  position    double precision,
  created_at  bigint      default 0
);

create index if not exists tasks_entity_id_idx on tasks(entity_id);


-- ─── Row-Level Security (RLS) ────────────────────────────────
-- These policies keep each user's data private.
-- If you want a single shared workspace (no auth), skip this block.

alter table entities enable row level security;
alter table tasks     enable row level security;

-- Allow all operations for the authenticated user only
create policy "entities: owner full access"
  on entities for all
  using      (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "tasks: owner full access"
  on tasks for all
  using      (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Enable real-time updates for entities and tasks
alter publication supabase_realtime add table entities, tasks;

-- ─── settings ────────────────────────────────────────────────
-- Stores app-level global configuration (e.g., router settings)

create table if not exists settings (
  key         text        primary key,
  value       jsonb       not null default '{}',
  updated_at  timestamptz not null default now()
);

-- Enable RLS
alter table settings enable row level security;

-- Owner policy
create policy "settings: owner full access"
  on settings for all
  using      (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Realtime
alter publication supabase_realtime add table settings;


-- ─── Phase 01: Workspaces ─────────────────────────────────────
-- Run this block against an existing database to migrate.

create table if not exists workspaces (
  id            text        primary key,
  name          text        not null,
  type          text        not null default 'personal',  -- 'personal' | 'shared'
  owner_id      uuid        references auth.users(id) on delete cascade,
  icon          text,
  color         text,
  active_modes  text[]      not null default '{life}',
  enabled_modes text[]      not null default '{life,knowledge,student,trader,creator,hobby-business}',
  settings      jsonb       default '{}',
  created_at    timestamptz not null default now()
);

alter table workspaces enable row level security;

create policy "workspaces: owner full access"
  on workspaces for all
  using      (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Add workspace_id + mode_id to entities
-- Note: workspace_id is intentionally a plain text column (no FK). The app uses
-- it to hold the id of a sidebar workspace-entity, which lives in `entities`,
-- not in the `workspaces` table.
alter table entities
  add column if not exists workspace_id text,
  add column if not exists mode_id      text,
  add column if not exists widget_layout jsonb;

create index if not exists entities_workspace_id_idx on entities(workspace_id);
create index if not exists entities_mode_id_idx      on entities(mode_id);

-- Add workspace_id + mode_id to tasks (workspace_id is plain text; see above)
alter table tasks
  add column if not exists workspace_id text,
  add column if not exists mode_id      text;

create index if not exists tasks_workspace_id_idx on tasks(workspace_id);

-- Backfill: assign all existing rows to the default personal workspace
-- Run only after inserting a ws-personal row for the user.
-- update entities set workspace_id = 'ws-personal' where workspace_id is null;
-- update tasks    set workspace_id = 'ws-personal' where workspace_id is null;

alter publication supabase_realtime add table workspaces;

-- ─── Phase 02: Life Mode ─────────────────────────────────────
-- Add domain tables for Life Mode.

create table if not exists habits (
  id            text        primary key,
  workspace_id  text        not null references workspaces(id) on delete cascade,
  title         text        not null,
  icon          text,
  color         text,
  frequency     text        not null default 'daily', -- 'daily' | 'weekly' | 'custom'
  schedule      jsonb       default '[]',             -- array of numbers 0-6
  created_at    bigint      not null default 0
);
alter table habits enable row level security;
create policy "habits: owner via workspace" on habits for all using (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())) with check (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

create table if not exists habit_checks (
  id            text        primary key,
  habit_id      text        not null references habits(id) on delete cascade,
  date          text        not null, -- 'YYYY-MM-DD'
  done          boolean     not null default false,
  unique(habit_id, date)
);
alter table habit_checks enable row level security;
create policy "habit_checks: owner via habit" on habit_checks for all using (exists (select 1 from habits h join workspaces w on h.workspace_id = w.id where h.id = habit_id and w.owner_id = auth.uid())) with check (exists (select 1 from habits h join workspaces w on h.workspace_id = w.id where h.id = habit_id and w.owner_id = auth.uid()));

create table if not exists mood_entries (
  id            text        primary key,
  workspace_id  text        not null references workspaces(id) on delete cascade,
  date          text        not null, -- 'YYYY-MM-DD'
  score         integer     not null, -- 1-5
  emoji         text,
  note          text,
  unique(workspace_id, date)
);
alter table mood_entries enable row level security;
create policy "mood_entries: owner via workspace" on mood_entries for all using (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())) with check (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

create table if not exists journal_entries (
  id            text        primary key,
  workspace_id  text        not null references workspaces(id) on delete cascade,
  date          text        not null, -- 'YYYY-MM-DD'
  content       jsonb       not null default '[]',
  prompt        text,
  unique(workspace_id, date)
);
alter table journal_entries enable row level security;
create policy "journal_entries: owner via workspace" on journal_entries for all using (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())) with check (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

create table if not exists goals (
  id            text        primary key,
  workspace_id  text        not null references workspaces(id) on delete cascade,
  title         text        not null,
  description   text,
  target_value  numeric,
  current_value numeric,
  unit          text,
  due_date      bigint,
  status        text        not null default 'active' -- 'active' | 'done' | 'archived'
);
alter table goals enable row level security;
create policy "goals: owner via workspace" on goals for all using (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())) with check (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

create table if not exists routines (
  id            text        primary key,
  workspace_id  text        not null references workspaces(id) on delete cascade,
  title         text        not null,
  steps         jsonb       not null default '[]', -- array of RoutineStep objects
  schedule      text,       -- 'morning' | 'evening' | 'custom'
  created_at    bigint      not null default 0
);
alter table routines enable row level security;
create policy "routines: owner via workspace" on routines for all using (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())) with check (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

create table if not exists routine_checks (
  id            text        primary key,
  routine_id    text        not null references routines(id) on delete cascade,
  step_id       text        not null,
  date          text        not null, -- 'YYYY-MM-DD'
  done          boolean     not null default false,
  unique(routine_id, step_id, date)
);
alter table routine_checks enable row level security;
create policy "routine_checks: owner via routine" on routine_checks for all using (exists (select 1 from routines r join workspaces w on r.workspace_id = w.id where r.id = routine_id and w.owner_id = auth.uid())) with check (exists (select 1 from routines r join workspaces w on r.workspace_id = w.id where r.id = routine_id and w.owner_id = auth.uid()));

alter publication supabase_realtime add table habits, habit_checks, mood_entries, journal_entries, goals, routines, routine_checks;

-- ─── Phase 03: Knowledge Manager Mode ────────────────────────

create table if not exists resources (
  id            text        primary key,
  workspace_id  text        not null references workspaces(id) on delete cascade,
  title         text        not null,
  url           text        not null,
  description   text,
  image_url     text,
  tags          text[]      not null default '{}',
  topic_id      text        references entities(id) on delete set null,
  created_at    bigint      not null default 0
);
alter table resources enable row level security;
create policy "resources: owner via workspace" on resources for all using (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())) with check (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

create table if not exists snippets (
  id            text        primary key,
  workspace_id  text        not null references workspaces(id) on delete cascade,
  title         text,
  body          text        not null,
  lang          text,
  tags          text[]      not null default '{}',
  topic_id      text        references entities(id) on delete set null,
  created_at    bigint      not null default 0
);
alter table snippets enable row level security;
create policy "snippets: owner via workspace" on snippets for all using (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())) with check (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

create table if not exists guides (
  id            text        primary key,
  workspace_id  text        not null references workspaces(id) on delete cascade,
  title         text        not null,
  steps         jsonb       not null default '[]',
  topic_id      text        references entities(id) on delete set null,
  tags          text[]      not null default '{}',
  created_at    bigint      not null default 0
);
alter table guides enable row level security;
create policy "guides: owner via workspace" on guides for all using (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())) with check (exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

alter publication supabase_realtime add table resources, snippets, guides;

-- ─── Phase 04: Telegram Bot & AI Admin ───────────────────────

create table if not exists limit_presets (
    id serial primary key,
    name text not null,
    daily_msg_limit int default 50,
    daily_image_limit int default 5,
    has_vision boolean default true,
    has_web_search boolean default true,
    has_image_gen boolean default true,
    is_default boolean default false,
    created_at timestamptz default now()
);

-- Note: We rename `users` to `telegram_users` to avoid conflict with auth.users
create table if not exists telegram_users (
    telegram_id bigint primary key,
    workspace_id text references workspaces(id) on delete set null,
    username text,
    access_mode text default 'DEV_POOL', -- 'DEV_POOL' or 'BYOK'
    encrypted_gemini_key text,
    iv text,
    preset_id int references limit_presets(id),
    messages_used_today int default 0,
    images_used_today int default 0,
    is_blocked boolean default false,
    last_active timestamptz default now()
);

create table if not exists vault (
    key_id text primary key, -- e.g., 'GEMINI_PRIMARY', 'HF_TOKEN'
    encrypted_value text not null,
    iv text not null,
    description text,
    updated_at timestamptz default now()
);

create table if not exists message_logs (
    id bigserial primary key,
    telegram_id bigint references telegram_users(telegram_id),
    topic_tag text,
    type text, -- 'text' or 'image'
    usage_type text default 'chat', -- 'chat' | 'tool' | 'search' | 'vision'
    role text default 'user', -- 'user' | 'model'
    content text,
    created_at timestamptz default now()
);

create table if not exists router_chains (
    category text primary key,
    model_list jsonb not null default '[]',
    system_prompt text,
    updated_at timestamptz default now()
);

alter table telegram_users enable row level security;
alter table message_logs enable row level security;
alter table router_chains enable row level security;
alter table vault enable row level security;

-- Only Admins (Service Role) can manage vault
create policy "vault: service role only" on vault for all using (false) with check (false);

-- Optional: Allow users to read router chains
-- ─── Phase 05: Bento Dashboards ─────────────────────────────

create table if not exists bento_layouts (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  context_id   text        not null,
  layout       jsonb       not null default '[]',
  updated_at   timestamptz not null default now(),
  primary key (user_id, context_id)
);

alter table bento_layouts enable row level security;

create policy "bento_layouts: owner full access" 
  on bento_layouts for all 
  using (user_id = auth.uid()) 
  with check (user_id = auth.uid());

alter publication supabase_realtime add table bento_layouts;


-- ─── Data API Access Grants ──────────────────────────────────
-- Required for projects created after May 30, 2026
-- and existing projects after October 30, 2026.

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage on all sequences in schema public to authenticated;
grant usage on all sequences in schema public to service_role;

