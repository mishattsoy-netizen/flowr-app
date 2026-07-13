-- user_uploads bucket + RLS: lets an authenticated user's browser upload chat
-- attachments directly to Storage, instead of going through a server route
-- that (on desktop) has no service-role key and silently falls back to
-- writing files to that machine's local disk (see spec §5c).
--
-- Public read (attachments are viewed via plain URLs in chat/tasks); writes
-- restricted to the authenticated user, into a folder keyed by their own
-- auth uid, so one user cannot overwrite another's files.
insert into storage.buckets (id, name, public, file_size_limit)
values ('user_uploads', 'user_uploads', true, 10485760)
on conflict (id) do nothing;

drop policy if exists "user_uploads_public_read" on storage.objects;
create policy "user_uploads_public_read" on storage.objects
  for select using (bucket_id = 'user_uploads');

drop policy if exists "user_uploads_own_insert" on storage.objects;
create policy "user_uploads_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'user_uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user_uploads_own_delete" on storage.objects;
create policy "user_uploads_own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'user_uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
