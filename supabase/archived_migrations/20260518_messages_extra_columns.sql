-- Add extra columns to messages table for image metadata and pipeline tracking
alter table if exists public.messages
  add column if not exists pipeline_steps jsonb,
  add column if not exists image_description text,
  add column if not exists image_prompt text;
