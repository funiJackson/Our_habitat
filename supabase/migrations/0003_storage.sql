-- ============================================================================
-- Storage buckets + policies
--
-- Apply AFTER the project's Storage service has been initialized
-- (visit Dashboard → Storage once, which creates the storage.* tables).
--
--   `memories`: shared photos/videos; couple-scoped path prefix.
--   `capsules`: time-locked media; same time-gate as time_capsules table.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('memories', 'memories', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('capsules', 'capsules', false)
on conflict (id) do nothing;

-- memories bucket: path must start with the user's couple_id
create policy "memories_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = public.current_user_couple_id()::text
  );

create policy "memories_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = public.current_user_couple_id()::text
  );

create policy "memories_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = public.current_user_couple_id()::text
  );

-- capsules bucket: time-gated read via join to time_capsules
create policy "capsules_read_after_unlock" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'capsules'
    and exists (
      select 1
      from public.time_capsules tc
      where tc.storage_path = storage.objects.name
        and tc.couple_id = public.current_user_couple_id()
        and (tc.sender_id = auth.uid() or tc.unlock_at <= now())
    )
  );

-- senders can write into their couple folder
create policy "capsules_sender_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'capsules'
    and (storage.foldername(name))[1] = public.current_user_couple_id()::text
  );
