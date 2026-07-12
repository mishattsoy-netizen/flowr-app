-- Router v2: PRIMARY tier rows (Smart/Light) for both modes. Idempotent.
insert into router_chains (category, mode, model_list, is_enabled)
select v.category, v.mode, '[]'::jsonb, true
from (values
  ('PRIMARY_SMART', 'default'), ('PRIMARY_SMART', 'pro'),
  ('PRIMARY_LIGHT', 'default'), ('PRIMARY_LIGHT', 'pro')
) as v(category, mode)
where not exists (
  select 1 from router_chains rc where rc.category = v.category and rc.mode = v.mode
);
