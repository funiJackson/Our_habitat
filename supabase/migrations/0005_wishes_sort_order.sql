-- ============================================================================
-- User-controlled ordering for wishes.
--
-- - sort_order ASC, then created_at DESC as stable tiebreak.
-- - New wishes default to sort_order=0; with created_at-desc tiebreak that
--   puts them at the top of the list naturally.
-- - reorder_wishes(p_ids) is a SECURITY DEFINER bulk update scoped to the
--   caller's couple, so the client doesn't need to pass couple_id and we
--   don't need a per-row RLS round trip.
-- ============================================================================

alter table public.wishes
  add column sort_order bigint not null default 0;

create index wishes_couple_sort_idx
  on public.wishes(couple_id, sort_order, created_at desc);

create or replace function public.reorder_wishes(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_couple_id uuid;
begin
  v_couple_id := public.current_user_couple_id();
  if v_couple_id is null then
    raise exception 'not paired';
  end if;

  update public.wishes w
  set sort_order = idx.ordinal,
      updated_at = now()
  from unnest(p_ids) with ordinality as idx(id, ordinal)
  where w.id = idx.id and w.couple_id = v_couple_id;
end;
$$;

revoke execute on function public.reorder_wishes(uuid[]) from public, anon;
grant   execute on function public.reorder_wishes(uuid[]) to authenticated;
