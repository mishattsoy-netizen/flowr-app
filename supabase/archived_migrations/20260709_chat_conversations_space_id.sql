-- Add space_id to conversations table for space-scoped chat isolation
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS space_id TEXT;

-- Backfill existing conversations with each user's default space
-- If a user has no default space, use their first space, or skip
UPDATE conversations c
SET space_id = sub.default_space_id
FROM (
  SELECT DISTINCT ON (s.owner_id)
    s.owner_id,
    s.id AS default_space_id
  FROM spaces s
  WHERE s.is_default = true
) sub
WHERE c.user_id = sub.owner_id
  AND c.space_id IS NULL;

-- For any remaining conversations without space_id (user has no default),
-- assign the first space we find for that user
UPDATE conversations c
SET space_id = sub.first_space_id
FROM (
  SELECT DISTINCT ON (s.owner_id)
    s.owner_id,
    s.id AS first_space_id
  FROM spaces s
  ORDER BY s.owner_id, s.id
) sub
WHERE c.user_id = sub.owner_id
  AND c.space_id IS NULL;

-- Make space_id NOT NULL after backfill
ALTER TABLE conversations
ALTER COLUMN space_id SET NOT NULL;
