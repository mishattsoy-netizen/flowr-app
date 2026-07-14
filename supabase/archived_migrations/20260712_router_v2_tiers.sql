-- Router v2: PRIMARY tier rows (Smart/Light) for both modes. Idempotent.
-- router_chains has no is_enabled column — per-model enablement lives inside
-- model_list JSONB (see router-config.ts RouterModel.is_enabled).
insert into router_chains (category, mode, model_list)
select v.category, v.mode, '[]'::jsonb
from (values
  ('PRIMARY_SMART', 'default'), ('PRIMARY_SMART', 'pro'),
  ('PRIMARY_LIGHT', 'default'), ('PRIMARY_LIGHT', 'pro')
) as v(category, mode)
where not exists (
  select 1 from router_chains rc where rc.category = v.category and rc.mode = v.mode
);
