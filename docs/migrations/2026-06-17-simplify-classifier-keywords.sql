-- Migration: Remap classifier keywords from removed categories to COMPLEX/WEB_SEARCH
-- Run this in Supabase SQL editor after deploying Phase 3 code changes.
-- Safe to run multiple times (idempotent via string replacement).

-- Remap keyword categories in bot_settings
UPDATE bot_settings 
SET content = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(content, '"REGULAR"', '"COMPLEX"'),
      '"CODING"', '"COMPLEX"'
    ),
    '"ADVISOR"', '"COMPLEX"'
  ),
  '"TOOLS"', '"COMPLEX"'
)
WHERE category = 'classifier_keywords';

-- Update any admin classifier prompt that references removed categories
-- (Optional — the DEFAULT_CLASSIFIER_PROMPT already handles fallback)
