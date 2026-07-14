-- ─── Spaces: Add is_default column ───────────────────────────────
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- At most one default per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_unique_default
  ON spaces(owner_id) WHERE is_default = true;

-- ─── Backfill: assign orphan rows to user's default space ────────

-- Tasks without a space_id → user's default space
UPDATE tasks t
SET space_id = s.id
FROM spaces s
WHERE t.owner_id = s.owner_id
  AND t.space_id IS NULL
  AND s.is_default = true;

-- Entities without a space_id → user's default space
UPDATE entities e
SET space_id = s.id
FROM spaces s
WHERE e.owner_id = s.owner_id
  AND e.space_id IS NULL
  AND s.is_default = true;

-- Remaining orphans (user has no default yet) → user's first space
UPDATE tasks t
SET space_id = s.id
FROM (
  SELECT DISTINCT ON (owner_id) id, owner_id
  FROM spaces
  WHERE owner_id IS NOT NULL
  ORDER BY owner_id, created_at ASC
) s
WHERE t.owner_id = s.owner_id
  AND t.space_id IS NULL;

UPDATE entities e
SET space_id = s.id
FROM (
  SELECT DISTINCT ON (owner_id) id, owner_id
  FROM spaces
  WHERE owner_id IS NOT NULL
  ORDER BY owner_id, created_at ASC
) s
WHERE e.owner_id = s.owner_id
  AND e.space_id IS NULL;

-- ─── Auto-register: create a "Main" space for new users ──────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.spaces (id, name, type, owner_id, is_default)
  VALUES ('space-' || gen_random_uuid(), 'Main', 'personal', NEW.id, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
