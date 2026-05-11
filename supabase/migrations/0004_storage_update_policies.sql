-- ============================================================================
-- Storage UPDATE policies — let upsert=true uploads overwrite existing objects
-- without tripping "new row violates RLS (USING expression)".
--
-- 0003 only added read/insert/delete. Mood selfies and theme covers re-upload
-- to the same path (one selfie per user/date; one cover per theme), so we need
-- UPDATE on storage.objects scoped the same way.
-- ============================================================================

create policy "memories_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = public.current_user_couple_id()::text
  )
  with check (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = public.current_user_couple_id()::text
  );

create policy "capsules_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'capsules'
    and (storage.foldername(name))[1] = public.current_user_couple_id()::text
  )
  with check (
    bucket_id = 'capsules'
    and (storage.foldername(name))[1] = public.current_user_couple_id()::text
  );
