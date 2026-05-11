-- ============================================================================
-- Sandz initial schema (core tables, RLS, RPCs)
--
-- Storage buckets + policies live in 0003_storage.sql, applied separately
-- after the project's Storage service is initialized via the Dashboard.
--
-- Design principles:
--   1. `couple_id` is the single tenancy edge — every row that holds couple
--      data references it. RLS uses public.current_user_couple_id() to scope
--      reads/writes to the caller's couple.
--   2. Pairing is atomic via SECURITY DEFINER RPC functions. Clients never
--      INSERT into invite_codes / never UPDATE couples directly.
--   3. Time capsules are gated server-side via RLS comparing unlock_at to
--      now(). Even direct SQL access cannot read locked content.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ===========================================================================
-- 1. couples (created first; FKs to users added after users table exists)
-- ===========================================================================
create table public.couples (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null,
  partner_id    uuid,
  anniversary   date,
  unbinding_at  timestamptz,
  theme_preset  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index couples_partner_id_unique
  on public.couples(partner_id)
  where partner_id is not null;

-- ===========================================================================
-- 2. users (mirrors auth.users with profile + couple membership)
-- ===========================================================================
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  couple_id     uuid references public.couples(id) on delete set null,
  birthday      date,
  timezone      text not null default 'Asia/Shanghai',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Wire the back-references from couples → users
alter table public.couples
  add constraint couples_owner_fk
  foreign key (owner_id) references public.users(id) on delete cascade;

alter table public.couples
  add constraint couples_partner_fk
  foreign key (partner_id) references public.users(id) on delete set null;

-- ===========================================================================
-- 3. helper: current_user_couple_id()
--    SECURITY DEFINER → bypasses RLS to avoid recursion on public.users.
-- ===========================================================================
create or replace function public.current_user_couple_id()
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select couple_id from public.users where id = auth.uid()
$$;

grant execute on function public.current_user_couple_id() to authenticated;

-- ===========================================================================
-- 4. handle_new_user trigger
--    After auth.users row created, mirror profile + create solo couple.
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_couple_id uuid;
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );

  insert into public.couples (owner_id) values (new.id) returning id into v_couple_id;

  update public.users set couple_id = v_couple_id where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- 5. invite_codes
-- ===========================================================================
create table public.invite_codes (
  code         text primary key,
  couple_id    uuid not null references public.couples(id) on delete cascade,
  created_by   uuid not null references public.users(id) on delete cascade,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  used_by      uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index invite_codes_couple_idx on public.invite_codes(couple_id);

-- ===========================================================================
-- 6. wishes
-- ===========================================================================
create type public.wish_status as enum ('todo', 'done');

create table public.wishes (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples(id) on delete cascade,
  created_by    uuid not null references public.users(id) on delete cascade,
  title         text not null,
  note          text,
  status        public.wish_status not null default 'todo',
  completed_at  timestamptz,
  completed_by  uuid references public.users(id) on delete set null,
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index wishes_couple_status_idx
  on public.wishes(couple_id, status, created_at desc);
create index wishes_tags_idx on public.wishes using gin (tags);

-- ===========================================================================
-- 7. monthly_themes
-- ===========================================================================
create table public.monthly_themes (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  year_month  text not null,
  title       text not null,
  description text,
  cover_url   text,
  created_by  uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (couple_id, year_month)
);

-- ===========================================================================
-- 8. albums + media_items (with circular FK for cover_media_id)
-- ===========================================================================
create table public.albums (
  id              uuid primary key default gen_random_uuid(),
  couple_id       uuid not null references public.couples(id) on delete cascade,
  name            text not null,
  cover_media_id  uuid,
  start_date      date,
  end_date        date,
  created_by      uuid not null references public.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create type public.media_kind as enum ('photo', 'video');

create table public.media_items (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples(id) on delete cascade,
  album_id      uuid references public.albums(id) on delete set null,
  uploaded_by   uuid not null references public.users(id) on delete cascade,
  kind          public.media_kind not null,
  storage_path  text not null,
  thumb_path    text,
  width         int,
  height        int,
  duration_ms   int,
  taken_at      timestamptz not null default now(),
  location      jsonb,
  description   text,
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create index media_couple_taken_idx on public.media_items(couple_id, taken_at desc);
create index media_album_idx on public.media_items(couple_id, album_id, taken_at desc);

alter table public.albums
  add constraint albums_cover_media_fk
  foreign key (cover_media_id) references public.media_items(id) on delete set null;

-- ===========================================================================
-- 9. moods
-- ===========================================================================
create table public.moods (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  date        date not null,
  emoji       text not null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index moods_couple_date_idx on public.moods(couple_id, date desc);

-- ===========================================================================
-- 10. time_capsules
-- ===========================================================================
create type public.capsule_kind as enum ('text', 'audio', 'image');

create table public.time_capsules (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples(id) on delete cascade,
  sender_id     uuid not null references public.users(id) on delete cascade,
  recipient_id  uuid not null references public.users(id) on delete cascade,
  kind          public.capsule_kind not null,
  content_text  text,
  storage_path  text,
  unlock_at     timestamptz not null,
  opened_at     timestamptz,
  notified      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index capsules_unlock_pending_idx
  on public.time_capsules(unlock_at)
  where notified = false;
create index capsules_couple_unlock_idx
  on public.time_capsules(couple_id, unlock_at desc);

-- ===========================================================================
-- 11. updated_at trigger
-- ===========================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger couples_updated_at before update on public.couples
  for each row execute function public.set_updated_at();
create trigger wishes_updated_at before update on public.wishes
  for each row execute function public.set_updated_at();
create trigger monthly_themes_updated_at before update on public.monthly_themes
  for each row execute function public.set_updated_at();
create trigger albums_updated_at before update on public.albums
  for each row execute function public.set_updated_at();
create trigger moods_updated_at before update on public.moods
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 12. Enable RLS
-- ===========================================================================
alter table public.users          enable row level security;
alter table public.couples        enable row level security;
alter table public.invite_codes   enable row level security;
alter table public.wishes         enable row level security;
alter table public.monthly_themes enable row level security;
alter table public.albums         enable row level security;
alter table public.media_items    enable row level security;
alter table public.moods          enable row level security;
alter table public.time_capsules  enable row level security;

-- ===========================================================================
-- 13. Policies
-- ===========================================================================

-- ---- users ----
create policy "users_read_own_couple" on public.users
  for select to authenticated
  using (
    id = auth.uid()
    or couple_id = public.current_user_couple_id()
  );

create policy "users_update_self" on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---- couples ----
create policy "couples_read_member" on public.couples
  for select to authenticated
  using (id = public.current_user_couple_id());

create policy "couples_update_member" on public.couples
  for update to authenticated
  using (id = public.current_user_couple_id())
  with check (id = public.current_user_couple_id());

-- ---- invite_codes (read only — INSERT only via RPC) ----
create policy "invite_codes_read_own_couple" on public.invite_codes
  for select to authenticated
  using (couple_id = public.current_user_couple_id());

-- ---- wishes ----
create policy "wishes_read" on public.wishes
  for select to authenticated
  using (couple_id = public.current_user_couple_id());
create policy "wishes_insert" on public.wishes
  for insert to authenticated
  with check (
    couple_id = public.current_user_couple_id()
    and created_by = auth.uid()
  );
create policy "wishes_update" on public.wishes
  for update to authenticated
  using (couple_id = public.current_user_couple_id())
  with check (couple_id = public.current_user_couple_id());
create policy "wishes_delete" on public.wishes
  for delete to authenticated
  using (couple_id = public.current_user_couple_id());

-- ---- monthly_themes ----
create policy "themes_read" on public.monthly_themes
  for select to authenticated
  using (couple_id = public.current_user_couple_id());
create policy "themes_insert" on public.monthly_themes
  for insert to authenticated
  with check (
    couple_id = public.current_user_couple_id()
    and created_by = auth.uid()
  );
create policy "themes_update" on public.monthly_themes
  for update to authenticated
  using (couple_id = public.current_user_couple_id())
  with check (couple_id = public.current_user_couple_id());

-- ---- albums ----
create policy "albums_read" on public.albums
  for select to authenticated
  using (couple_id = public.current_user_couple_id());
create policy "albums_insert" on public.albums
  for insert to authenticated
  with check (
    couple_id = public.current_user_couple_id()
    and created_by = auth.uid()
  );
create policy "albums_update" on public.albums
  for update to authenticated
  using (couple_id = public.current_user_couple_id())
  with check (couple_id = public.current_user_couple_id());
create policy "albums_delete" on public.albums
  for delete to authenticated
  using (couple_id = public.current_user_couple_id());

-- ---- media_items ----
create policy "media_read" on public.media_items
  for select to authenticated
  using (couple_id = public.current_user_couple_id());
create policy "media_insert" on public.media_items
  for insert to authenticated
  with check (
    couple_id = public.current_user_couple_id()
    and uploaded_by = auth.uid()
  );
create policy "media_update" on public.media_items
  for update to authenticated
  using (couple_id = public.current_user_couple_id())
  with check (couple_id = public.current_user_couple_id());
create policy "media_delete" on public.media_items
  for delete to authenticated
  using (couple_id = public.current_user_couple_id());

-- ---- moods ----
create policy "moods_read" on public.moods
  for select to authenticated
  using (couple_id = public.current_user_couple_id());
create policy "moods_insert" on public.moods
  for insert to authenticated
  with check (
    couple_id = public.current_user_couple_id()
    and user_id = auth.uid()
  );
create policy "moods_update" on public.moods
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "moods_delete" on public.moods
  for delete to authenticated
  using (user_id = auth.uid());

-- ---- time_capsules — the security-critical one ----
create policy "capsules_read_after_unlock_or_self" on public.time_capsules
  for select to authenticated
  using (
    couple_id = public.current_user_couple_id()
    and (
      sender_id = auth.uid()
      or unlock_at <= now()
    )
  );

create policy "capsules_insert" on public.time_capsules
  for insert to authenticated
  with check (
    couple_id = public.current_user_couple_id()
    and sender_id = auth.uid()
  );

-- recipient may mark opened_at on already-unlocked capsules
create policy "capsules_recipient_mark_opened" on public.time_capsules
  for update to authenticated
  using (
    couple_id = public.current_user_couple_id()
    and recipient_id = auth.uid()
    and unlock_at <= now()
  )
  with check (
    couple_id = public.current_user_couple_id()
    and recipient_id = auth.uid()
  );

-- sender may delete their own still-locked capsule (regret window)
create policy "capsules_sender_delete_locked" on public.time_capsules
  for delete to authenticated
  using (
    sender_id = auth.uid()
    and unlock_at > now()
  );

-- ===========================================================================
-- 14. Pairing RPCs (atomic, server-enforced)
-- ===========================================================================

-- search_path must include `extensions` so gen_random_bytes() resolves —
-- on hosted Supabase pgcrypto lives in the extensions schema, not public.
-- Without it, calls fail with SQLSTATE 42883 which PostgREST surfaces as
-- HTTP 404 (looks identical to "function not found"; very misleading).
create or replace function public.generate_invite_code()
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_couple_id uuid;
  v_code      text;
  v_expires   timestamptz := now() + interval '24 hours';
  v_attempts  int := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Caller must own a couple that has no partner yet
  select c.id into v_couple_id
  from public.couples c
  where c.owner_id = auth.uid() and c.partner_id is null
  limit 1;

  if v_couple_id is null then
    raise exception 'no couple available for pairing (already paired or not the owner)';
  end if;

  loop
    v_attempts := v_attempts + 1;
    -- 6 chars; strip ambiguous: 0/O/I/1/L/+/=//
    v_code := upper(
      substr(
        translate(encode(gen_random_bytes(8), 'base64'), '+/=oOiIlL01', ''),
        1, 6
      )
    );
    if length(v_code) = 6 then
      begin
        insert into public.invite_codes (code, couple_id, created_by, expires_at)
        values (v_code, v_couple_id, auth.uid(), v_expires);
        exit;
      exception when unique_violation then
        if v_attempts > 10 then
          raise exception 'could not generate unique code';
        end if;
      end;
    end if;
  end loop;

  return json_build_object('code', v_code, 'expires_at', v_expires);
end;
$$;

grant execute on function public.generate_invite_code() to authenticated;

create or replace function public.redeem_invite_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_couple_id     uuid;
  v_owner_id      uuid;
  v_caller        uuid := auth.uid();
  v_caller_couple uuid;
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;

  -- Lock the matching, valid invite code
  select ic.couple_id into v_couple_id
  from public.invite_codes ic
  where ic.code = upper(p_code)
    and ic.used_at is null
    and ic.expires_at > now()
  for update;

  if v_couple_id is null then
    raise exception 'invalid or expired code';
  end if;

  select owner_id into v_owner_id from public.couples where id = v_couple_id;
  if v_owner_id = v_caller then
    raise exception 'cannot redeem your own code';
  end if;

  select c.id into v_caller_couple
  from public.couples c
  where c.owner_id = v_caller and c.partner_id is null
  limit 1;

  if v_caller_couple is null then
    raise exception 'caller is already paired';
  end if;

  if exists (
    select 1 from public.couples
    where id = v_couple_id and partner_id is not null
  ) then
    raise exception 'this code is already used';
  end if;

  -- Atomic pairing
  update public.couples
    set partner_id = v_caller, updated_at = now()
    where id = v_couple_id;

  update public.users
    set couple_id = v_couple_id, updated_at = now()
    where id = v_caller;

  delete from public.couples where id = v_caller_couple;

  update public.invite_codes
    set used_at = now(), used_by = v_caller
    where code = upper(p_code);

  return json_build_object('couple_id', v_couple_id);
end;
$$;

grant execute on function public.redeem_invite_code(text) to authenticated;
