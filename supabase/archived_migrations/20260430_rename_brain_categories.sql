-- Step 1: Drop the old constraint
ALTER TABLE bot_brain_entries DROP CONSTRAINT IF EXISTS bot_brain_entries_category_check;

-- Step 2: Update existing rows to the NEW final labels
-- We map from whatever they currently are (mistakes/patterns/questions) to the final ones
UPDATE bot_brain_entries SET category = 'red_flags' WHERE category IN ('guardrails', 'mistakes');
UPDATE bot_brain_entries SET category = 'tone' WHERE category IN ('style', 'patterns');
UPDATE bot_brain_entries SET category = 'facts' WHERE category IN ('knowledge', 'questions');

-- Step 3: Add the new constraint with the final chosen IDs
ALTER TABLE bot_brain_entries ADD CONSTRAINT bot_brain_entries_category_check 
  CHECK (category IN ('rules', 'red_flags', 'tone', 'personality', 'facts'));
