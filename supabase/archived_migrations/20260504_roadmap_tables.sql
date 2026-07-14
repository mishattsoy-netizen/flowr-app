-- Roadmap Phases
CREATE TABLE IF NOT EXISTS roadmap_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
  sort_order INT NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#E09952',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Roadmap Tasks
CREATE TABLE IF NOT EXISTS roadmap_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES roadmap_phases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  sort_order INT NOT NULL DEFAULT 0,
  sub_tasks JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT '{}',
  agent_prompt TEXT DEFAULT '',
  prompt_context TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Roadmap AI Chat History
CREATE TABLE IF NOT EXISTS roadmap_ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Roadmap Bot Config (system prompt, router config)
CREATE TABLE IF NOT EXISTS roadmap_bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt TEXT DEFAULT '',
  classifier_prompt TEXT DEFAULT 'Classify this message into one category: COMPLEX (deep analysis, planning, prompt generation), FAST (quick edits, simple questions), WEB_SEARCH (needs internet research), VISION (analyzing images).\nRespond with ONLY the category name.',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Roadmap Router Chains (separate from main router)
CREATE TABLE IF NOT EXISTS roadmap_router_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE CHECK (category IN ('CLASSIFIER', 'COMPLEX', 'FAST', 'VISION', 'WEB_SEARCH')),
  model_list JSONB DEFAULT '[]'::jsonb,
  system_prompt TEXT DEFAULT '',
  temperature NUMERIC DEFAULT 0.7,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default router chains
INSERT INTO roadmap_router_chains (category, model_list) VALUES
  ('CLASSIFIER', '[]'::jsonb),
  ('COMPLEX', '[]'::jsonb),
  ('FAST', '[]'::jsonb),
  ('VISION', '[]'::jsonb),
  ('WEB_SEARCH', '[]'::jsonb)
ON CONFLICT (category) DO NOTHING;

-- Seed default bot config
INSERT INTO roadmap_bot_config (system_prompt, classifier_prompt) VALUES (
  'You are a project planning assistant for Flowr, a Next.js productivity app. Help break down features into phases and tasks. For each task, generate an agent_prompt that can be copy-pasted to a coding assistant. Include file paths, code patterns, and implementation details in prompts.',
  'Classify this message into one category: COMPLEX (deep analysis, planning, prompt generation), FAST (quick edits, simple questions), WEB_SEARCH (needs internet research), VISION (analyzing images).\nRespond with ONLY the category name.'
) ON CONFLICT DO NOTHING;

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_roadmap_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_roadmap_phases_updated BEFORE UPDATE ON roadmap_phases FOR EACH ROW EXECUTE FUNCTION update_roadmap_updated_at();
CREATE TRIGGER trg_roadmap_tasks_updated BEFORE UPDATE ON roadmap_tasks FOR EACH ROW EXECUTE FUNCTION update_roadmap_updated_at();
CREATE TRIGGER trg_roadmap_ai_chats_updated BEFORE UPDATE ON roadmap_ai_chats FOR EACH ROW EXECUTE FUNCTION update_roadmap_updated_at();
CREATE TRIGGER trg_roadmap_bot_config_updated BEFORE UPDATE ON roadmap_bot_config FOR EACH ROW EXECUTE FUNCTION update_roadmap_updated_at();

-- Enable RLS (admin-only access)
ALTER TABLE roadmap_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_ai_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_router_chains ENABLE ROW LEVEL SECURITY;
