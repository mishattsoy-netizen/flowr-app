-- Add VISION category to router_chains for both platforms
-- Configure vision models via Router admin UI

-- Add platform column if it doesn't exist yet (idempotent)
ALTER TABLE router_chains ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'telegram';

-- Insert VISION rows for each platform — skip if already present
INSERT INTO router_chains (platform, category, model_list, system_prompt)
SELECT 'app', 'VISION', '[]'::jsonb, ''
WHERE NOT EXISTS (SELECT 1 FROM router_chains WHERE category = 'VISION' AND platform = 'app');

INSERT INTO router_chains (platform, category, model_list, system_prompt)
SELECT 'telegram', 'VISION', '[]'::jsonb, ''
WHERE NOT EXISTS (SELECT 1 FROM router_chains WHERE category = 'VISION' AND platform = 'telegram');
