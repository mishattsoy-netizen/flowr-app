-- Optional icon name for brains (matches entity icon names / ICON_MAP keys)
ALTER TABLE brains ADD COLUMN IF NOT EXISTS icon text;
