-- canvas_blocks: stores EditorBlock rows for canvas entities
create table if not exists canvas_blocks (
  id            text primary key,
  canvas_id     text not null references entities(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  workspace_id  text,
  type          text not null,
  shape_kind    text,
  x             float,
  y             float,
  width         float,
  height        float,
  content       text,
  style         jsonb,
  points        jsonb,
  parent_id     text,
  z_index       int default 0,
  group_id      text,
  updated_at    timestamptz not null default now()
);

-- Index for fast canvas lookups
create index if not exists canvas_blocks_canvas_id_idx on canvas_blocks(canvas_id);

-- RLS
alter table canvas_blocks enable row level security;

create policy "Users can read their own canvas blocks"
  on canvas_blocks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own canvas blocks"
  on canvas_blocks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own canvas blocks"
  on canvas_blocks for update
  using (auth.uid() = user_id);

create policy "Users can delete their own canvas blocks"
  on canvas_blocks for delete
  using (auth.uid() = user_id);

-- Enable realtime for this table
alter publication supabase_realtime add table canvas_blocks;
