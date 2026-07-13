-- user_uploads bucket + RLS: lets an authenticated user's browser upload chat
-- attachments directly to Storage, instead of going through a server route
-- that (on desktop) has no service-role key and silently falls back to
-- writing files to that machine's local disk (see spec §5c).
--
-- SECURITY: allowed_mime_types is enforced by Supabase Storage SERVER-SIDE,
-- independent of whatever content-type the uploading browser claims. Without
-- this, an attacker could upload an .html file with a spoofed content-type
-- and get back a publicly-servable URL — stored XSS from a trusted-looking
-- supabase.co origin. This allowlist matches the app's actual attachment
-- categories (image/audio/video/pdf) and excludes anything a browser could
-- ever render as active content (html, svg+xml, javascript, etc).
--
-- Public read (attachments are viewed via plain <img src>/<audio src> with no
-- custom auth headers — see ChatMessage.tsx). Ownership-gated read via signed
-- URLs is a known follow-up (would require reworking AIAttachment to store a
-- storage path instead of a permanent URL, and re-signing on render) — not
-- done here; public read is an explicitly accepted tradeoff for now, at the
-- same exposure level as the previous /api/images proxy. Writes are
-- restricted to the authenticated user, into a folder keyed by their own auth
-- uid, so one user cannot overwrite another's files.
-- text/plain and text/markdown are included (genuinely inert, safe to serve
-- as-is). Office formats (docx etc.) and anything HTML/script-adjacent are
-- deliberately excluded — docx needs server-side text extraction per spec
-- §5b, and raw HTML/SVG hosting is exactly the XSS vector this migration
-- closes. The file picker (AIAssistant.tsx / TaskInspectorPanel.tsx) has no
-- `accept` restriction today, so a rejected upload is a real, if rare,
-- user-facing case — Storage returns an error, the client removes the
-- optimistic attachment and logs it (no toast yet; follow-up UX polish).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user_uploads', 'user_uploads', true, 10485760,
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf', 'text/plain', 'text/markdown'
  ]
)
on conflict (id) do update set allowed_mime_types = excluded.allowed_mime_types;

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
