-- Models registry: tracks all AI models used across the system with daily RPD usage

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'google',
  input_modalities TEXT[] NOT NULL DEFAULT ARRAY['text'],
  output_modalities TEXT[] NOT NULL DEFAULT ARRAY['text'],
  max_rpd INTEGER,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  usage_today INTEGER NOT NULL DEFAULT 0,
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomic upsert: increments usage_today, resets daily if date changed, auto-inserts unknown models
CREATE OR REPLACE FUNCTION increment_model_usage(p_model_id TEXT, p_provider TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO models (id, provider, usage_today, last_reset_date, updated_at)
  VALUES (p_model_id, p_provider, 1, CURRENT_DATE, NOW())
  ON CONFLICT (id) DO UPDATE SET
    usage_today = CASE
      WHEN models.last_reset_date < CURRENT_DATE THEN 1
      ELSE models.usage_today + 1
    END,
    last_reset_date = CURRENT_DATE,
    updated_at = NOW();
END;
$$;

-- Seed known models from PROVIDER_MODELS catalog
INSERT INTO models (id, provider, input_modalities, output_modalities, max_rpd, sort_order)
VALUES
  -- Google models
  ('gemini-2.0-flash-lite',    'google', ARRAY['text','image'], ARRAY['text'], 1500,  1),
  ('gemini-2.5-flash',         'google', ARRAY['text','image'], ARRAY['text'], 20,    2),
  ('gemini-2.5-flash-lite',    'google', ARRAY['text','image'], ARRAY['text'], 20,    3),
  ('gemini-2.5-flash-8b',      'google', ARRAY['text','image'], ARRAY['text'], 1500,  4),
  ('gemini-3-flash',           'google', ARRAY['text','image'], ARRAY['text'], 20,    5),
  ('gemini-3.1-flash-lite',    'google', ARRAY['text','image'], ARRAY['text'], 500,   6),
  ('gemini-3-flash-live',      'google', ARRAY['text','image'], ARRAY['text'], NULL,  7),
  ('gemini-3.1-flash-tts',     'google', ARRAY['text'],         ARRAY['audio'],NULL,  8),
  ('gemini-2.5-flash-native-audio-dialog','google',ARRAY['text','audio'],ARRAY['audio'],NULL,9),
  ('google-search-grounding',  'google', ARRAY['text'],         ARRAY['text'], 1500,  10),
  ('imagen-4-ultra-generate',  'google', ARRAY['text'],         ARRAY['image'],25,    11),
  ('imagen-4-fast-generate',   'google', ARRAY['text'],         ARRAY['image'],25,    12),
  ('imagen-4-generate',        'google', ARRAY['text'],         ARRAY['image'],25,    13),
  ('gemma-4-31b',              'google', ARRAY['text'],         ARRAY['text'], 1500,  14),
  ('gemma-4-26b',              'google', ARRAY['text'],         ARRAY['text'], 1500,  15),
  ('gemma-3-4b',               'google', ARRAY['text'],         ARRAY['text'], 1500,  16),
  ('allam-2-7b',               'google', ARRAY['text'],         ARRAY['text'], NULL,  17),
  -- Groq models
  ('llama-3.3-70b-versatile',  'groq',   ARRAY['text'],         ARRAY['text'], 1000,  18),
  ('llama-3.1-8b-instant',     'groq',   ARRAY['text'],         ARRAY['text'], 14400, 19),
  ('qwen/qwen3-32b',           'groq',   ARRAY['text'],         ARRAY['text'], 1000,  20),
  ('openai/gpt-oss-120b',      'groq',   ARRAY['text'],         ARRAY['text'], 1000,  21),
  ('whisper-large-v3-turbo',   'groq',   ARRAY['audio'],        ARRAY['text'], 2000,  22),
  ('whisper-large-v3',         'groq',   ARRAY['audio'],        ARRAY['text'], 2000,  23),
  -- Cloudflare
  ('cloudflare-workers-ai',    'cloudflare', ARRAY['text'],     ARRAY['image'],100000,24),
  -- HuggingFace
  ('huggingface-stable-diffusion','huggingface',ARRAY['text'],  ARRAY['image'],NULL,  25),
  -- Vault / search
  ('tavily-search',            'vault',  ARRAY['text'],         ARRAY['text'], NULL,  26),
  ('duckduckgo-search',        'vault',  ARRAY['text'],         ARRAY['text'], NULL,  27)
ON CONFLICT (id) DO NOTHING;
