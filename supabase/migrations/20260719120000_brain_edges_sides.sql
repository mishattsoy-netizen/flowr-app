-- Optional pinned connector sides for brain edges (null = auto closestSides).
alter table public.brain_edges
  add column if not exists from_side text null,
  add column if not exists to_side text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'brain_edges_from_side_check'
  ) then
    alter table public.brain_edges
      add constraint brain_edges_from_side_check
      check (from_side is null or from_side in ('top', 'right', 'bottom', 'left'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'brain_edges_to_side_check'
  ) then
    alter table public.brain_edges
      add constraint brain_edges_to_side_check
      check (to_side is null or to_side in ('top', 'right', 'bottom', 'left'));
  end if;
end $$;
