-- Add tool_results column to messages table to persist tool cards in chat history
alter table if exists public.messages
  add column if not exists tool_results jsonb;
