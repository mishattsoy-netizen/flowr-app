-- Add citations column to messages table for web search source persistence
alter table if exists public.messages
  add column if not exists citations jsonb;
