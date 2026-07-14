-- Atomic append for telegram album coordination (spec §5d bug 1).
-- The previous read-modify-write in the webhook could lose file_ids when two
-- invocations for the same album interleaved (both read, both write, one
-- append vanishes). This upsert appends in a single statement and returns the
-- array as it stands after this append, so the caller can later detect
-- whether more photos arrived during its settle window.
create or replace function append_telegram_media_file(
  p_media_group_id text,
  p_chat_id text,
  p_file_id text,
  p_caption text
) returns jsonb
language sql
as $$
  insert into telegram_media_groups (media_group_id, chat_id, file_ids, caption)
  values (p_media_group_id, p_chat_id, jsonb_build_array(p_file_id), p_caption)
  on conflict (media_group_id) do update
    set file_ids = telegram_media_groups.file_ids || jsonb_build_array(p_file_id),
        caption  = coalesce(telegram_media_groups.caption, excluded.caption)
  returning file_ids;
$$;
