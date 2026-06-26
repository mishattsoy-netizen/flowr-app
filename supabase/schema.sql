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
  owner_id     uuid        references auth.users(id) on delete cascade,
  last_modified bigint     not null default 0,
  icon         text,
  tags         text[]      default '{}',
  content      jsonb       default '[]',       -- EditorBlock[]
  sort_order   integer     default 0,
  created_at   timestamptz not null default now(),
  workspace_id text,
  mode_id      text,
  widget_layout jsonb
);

create index if not exists entities_parent_id_idx on entities(parent_id);
create index if not exists entities_type_idx      on entities(type);
create index if not exists entities_workspace_id_idx on entities(workspace_id);
create index if not exists entities_mode_id_idx      on entities(mode_id);


-- ─── tasks ───────────────────────────────────────────────────

create table if not exists tasks (
  id          text        primary key,
  title       text        not null default '',
  completed   boolean     not null default false,
  due_date    text,                             -- 'YYYY-MM-DD'
  entity_id   text        references entities(id) on delete set null,
  owner_id    uuid        references auth.users(id) on delete cascade,
  note        text,
  color       text,
  priority    text        check (priority in ('low', 'medium', 'high')),
  difficulty  integer,
  status      text        check (status in ('todo', 'in-progress', 'done')),
  position    double precision,
  created_at  bigint      default 0,
  workspace_id text,
  mode_id      text,
  subtasks    jsonb,
  completed_at bigint,
  description text,
  user_due_date text
);

create index if not exists tasks_entity_id_idx on tasks(entity_id);
create index if not exists tasks_workspace_id_idx on tasks(workspace_id);

-- Owner-id index for RLS filtering performance
create index if not exists idx_entities_owner_id on entities(owner_id);
create index if not exists idx_tasks_owner_id on tasks(owner_id);


-- ─── Row-Level Security (RLS) ────────────────────────────────
-- These policies keep each user's data private.
-- If you want a single shared workspace (no auth), skip this block.

alter table entities enable row level security;
alter table tasks     enable row level security;

-- ENTITIES: users can only access their own rows
drop policy if exists "entities: owner full access" on entities;

create policy "entities_select_own" on entities
  for select using (owner_id = auth.uid());

create policy "entities_insert_own" on entities
  for insert with check (owner_id = auth.uid());

create policy "entities_update_own" on entities
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "entities_delete_own" on entities
  for delete using (owner_id = auth.uid());

-- TASKS: users can only access their own rows
drop policy if exists "tasks: owner full access" on tasks;

create policy "tasks_select_own" on tasks
  for select using (owner_id = auth.uid());

create policy "tasks_insert_own" on tasks
  for insert with check (owner_id = auth.uid());

create policy "tasks_update_own" on tasks
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "tasks_delete_own" on tasks
  for delete using (owner_id = auth.uid());

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
  settings      jsonb       default '{}',
  created_at    timestamptz not null default now()
);

alter table workspaces enable row level security;

create policy "workspaces: owner full access"
  on workspaces for all
  using      (owner_id = auth.uid())
  with check (owner_id = auth.uid());

alter publication supabase_realtime add table workspaces;


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
