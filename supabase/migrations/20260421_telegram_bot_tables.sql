-- ============================================================
-- Telegram Bot Tables — unified into main app Supabase
-- ============================================================

-- 1. Limit Presets — table already exists in this Supabase project, skip creation

-- 2. Telegram Users
CREATE TABLE IF NOT EXISTS telegram_users (
    telegram_id         BIGINT PRIMARY KEY,
    username            TEXT,
    access_mode         TEXT DEFAULT 'DEV_POOL',  -- 'DEV_POOL' | 'BYOK'
    encrypted_gemini_key TEXT,
    iv                  TEXT,
    preset_id           INT REFERENCES limit_presets(id),
    messages_used_today INT DEFAULT 0,
    images_used_today   INT DEFAULT 0,
    is_blocked          BOOLEAN DEFAULT false,
    last_active         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Vault (AI engine secrets — key_id matches getVaultKey() calls)
CREATE TABLE IF NOT EXISTS vault (
    key_id          TEXT PRIMARY KEY,
    encrypted_value TEXT NOT NULL,
    iv              TEXT,
    description     TEXT,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Message Logs (for analytics)
CREATE TABLE IF NOT EXISTS message_logs (
    id          BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES telegram_users(telegram_id),
    content     TEXT,
    role        TEXT,                   -- 'user' | 'model'
    type        TEXT,                   -- 'text' | 'image'
    usage_type  TEXT,                   -- 'chat' | 'tool' | 'search' | 'vision'
    topic_tag   TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Router Chains (the Flowr routing engine config)
CREATE TABLE IF NOT EXISTS router_chains (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category    TEXT NOT NULL UNIQUE,   -- matches IntentCategory enum
    model_list  JSONB NOT NULL DEFAULT '[]'::jsonb,
    system_prompt TEXT,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Seed: default presets
-- ============================================================
INSERT INTO limit_presets (name, daily_msg_limit, daily_image_limit, has_vision, has_web_search, has_image_gen)
VALUES
    ('Standard',    50,   0, false, false, false),
    ('Power User', 200,   0, false, false, false),
    ('Developer', 1000,   0, false, false, false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed: default router chains (matches IntentCategory in router-config.ts)
-- ============================================================
INSERT INTO router_chains (category, model_list, system_prompt) VALUES
('FAST_SIMPLE', '[
  {"id": "gemini-2.0-flash-lite", "provider": "google", "is_enabled": true},
  {"id": "llama-3.1-8b-instant",  "provider": "groq",   "is_enabled": true}
]'::jsonb, 'You are Flowr AI, a fast and helpful assistant. Be concise.'),

('COMPLEX_THINKING', '[
  {"id": "gemini-2.5-flash",      "provider": "google", "is_enabled": true},
  {"id": "llama-3.3-70b-versatile","provider": "groq",  "is_enabled": true}
]'::jsonb, 'You are Flowr AI. Think step by step and provide thorough answers.'),

('MEDIUM_THINKING', '[
  {"id": "gemini-2.0-flash",      "provider": "google", "is_enabled": true},
  {"id": "llama-3.1-70b-versatile","provider": "groq",  "is_enabled": true}
]'::jsonb, null),

('IMAGE_GEN', '[
  {"id": "black-forest-labs/FLUX.1-schnell", "provider": "huggingface", "is_enabled": true}
]'::jsonb, null),

('WEB_SEARCH', '[
  {"id": "tavily-search",         "provider": "vault",  "is_enabled": true},
  {"id": "gemini-2.0-flash",      "provider": "google", "is_enabled": true}
]'::jsonb, null),

('AUDIO_VOICE', '[
  {"id": "whisper-large-v3-turbo","provider": "groq",   "is_enabled": true},
  {"id": "gemini-3.1-flash-tts",  "provider": "google", "is_enabled": true}
]'::jsonb, null),

('TOOL_CALLING', '[
  {"id": "gemini-2.5-flash",      "provider": "google", "is_enabled": true}
]'::jsonb, null)

ON CONFLICT (category) DO NOTHING;
