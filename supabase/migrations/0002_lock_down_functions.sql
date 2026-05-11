-- ============================================================================
-- Tighten SECURITY DEFINER function exposure.
--
-- Postgres grants EXECUTE to PUBLIC by default, which means the `anon` role
-- can hit our RPCs unauthenticated. Each function checks `auth.uid()` already,
-- but defense-in-depth: revoke from PUBLIC + anon, keep authenticated grants.
-- handle_new_user is a trigger-only function and shouldn't be RPC-callable
-- by anyone.
-- ============================================================================

revoke execute on function public.current_user_couple_id() from public, anon;
revoke execute on function public.generate_invite_code()    from public, anon;
revoke execute on function public.redeem_invite_code(text)  from public, anon;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Pin search_path on the updated_at trigger function (advisor 0011).
alter function public.set_updated_at() set search_path = public;
