-- =============================================================================
-- jarvis-files: where the brain's cloud executor leaves what it made.
--
-- On LiveKit Cloud the executor works in a temporary folder that disappears
-- with the worker, so the results are uploaded here under
-- `<user_id>/<kwami_id>/<task>/...`. The agent uploads with the service-role
-- key, which bypasses RLS. The policies below are for the user, from the app:
-- each user reaches only the folder named after their own id.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('jarvis-files', 'jarvis-files', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can read own jarvis files" on storage.objects;
create policy "Users can read own jarvis files"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'jarvis-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload own jarvis files" on storage.objects;
create policy "Users can upload own jarvis files"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'jarvis-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update own jarvis files" on storage.objects;
create policy "Users can update own jarvis files"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'jarvis-files' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'jarvis-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own jarvis files" on storage.objects;
create policy "Users can delete own jarvis files"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'jarvis-files' and (storage.foldername(name))[1] = auth.uid()::text);
