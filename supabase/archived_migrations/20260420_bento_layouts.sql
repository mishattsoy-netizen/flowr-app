create table if not exists public.bento_layouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  context_id  text not null,
  layout      jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

create unique index if not exists bento_layouts_user_context
  on public.bento_layouts(user_id, context_id);

alter table public.bento_layouts enable row level security;

create policy "Users manage own layouts"
  on public.bento_layouts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table bento_layouts;
