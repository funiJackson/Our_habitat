---
title: PostgREST returns 404 for RPC because pgcrypto lives in extensions schema, not public
date: 2026-05-09
category: docs/solutions/database-issues/
module: supabase-rpcs
problem_type: database_issue
component: database
symptoms:
  - HTTP 404 from POST /rest/v1/rpc/generate_invite_code with valid user JWT
  - Anonymous calls return expected 401 "permission denied", masking the real failure mode
  - Response body contains {"code":"42883","message":"function gen_random_bytes(integer) does not exist"} despite the function existing
  - Pairing flow completely broken in browser; identical-looking 404 misleads debugging toward PostgREST schema cache and RETURNS TABLE theories
  - redeem_invite_code and handle_new_user exhibit the same failure pattern when they touch pgcrypto
root_cause: config_error
resolution_type: code_fix
severity: high
tags: [supabase, postgrest, pgcrypto, search-path, rpc, sqlstate-42883]
---

# PostgREST returns 404 for RPC because pgcrypto lives in extensions schema, not public

## Problem

A `/pair` page call to the SECURITY DEFINER RPC `generate_invite_code` returned HTTP 404 from PostgREST, even though the function existed and had correct ACLs. The real cause was a Postgres `42883 undefined_function` raised inside the function body for `gen_random_bytes()`, which PostgREST maps to HTTP 404 — masquerading as a "function not found / schema cache" error.

## Symptoms

- Browser network tab on signup-then-pair flow:
  ```
  POST https://<project>.supabase.co/rest/v1/rpc/generate_invite_code
  → 404 (Not Found)
  ```
- Frontend toast in `src/lib/couple.ts` caller path: `生成失败`.
- Function visibly present in `pg_proc`; ACL inspection shows `authenticated=X/postgres` after grants.
- Anon-key curl probe (no user JWT) returns a *different* error:
  ```
  401  { "message": "permission denied for function generate_invite_code" }
  ```
- After temporarily `GRANT EXECUTE ... TO PUBLIC`, anon-key curl returns `400 not authenticated` (the body's `auth.uid() is null` guard fires) — but a real user JWT still returns 404.
- Response **body** of the 404 (the signal that finally cracked it):
  ```json
  {
    "code": "42883",
    "details": null,
    "hint": "No function matches the given name and argument types. You might need to add explicit type casts.",
    "message": "function gen_random_bytes(integer) does not exist"
  }
  ```
- `notify pgrst, 'reload schema'` / `'reload config'`, re-issuing GRANTs, and DROP+CREATE of the function do not change the 404.

## What Didn't Work

**Hypothesis 1 — PostgREST schema cache stale.** We had just run `revoke execute ... from public, anon` and `grant ... to authenticated` on both pairing RPCs, so the obvious theory was that PostgREST's in-memory schema cache hadn't picked up the new visibility. We fired `notify pgrst, 'reload schema'` and `notify pgrst, 'reload config'`, re-ran the GRANTs, then dropped and recreated the functions outright. ACL inspection confirmed `authenticated=X/postgres`. The browser kept returning 404, so a stale cache wasn't the cause.

**Hypothesis 2 — PostgREST 12 per-role cache bug with `RETURNS TABLE` + SECURITY DEFINER.** Anon-key curl returned `401 permission denied` (proving PostgREST *did* know the function existed and routed the call), while the authenticated JWT returned 404. That asymmetry looked like a per-role reverse-cache bug — anon's cache had the function, authenticated's didn't. An adversarial-reviewer agent backed this at 0.78 confidence, citing PGRST202 and the recent `sb_publishable_*` + ES256 JWT migration as plausible aggravators. We rewrote both RPCs from `RETURNS TABLE(...)` to `RETURNS json` via `json_build_object(...)` and dropped `.single()` from `src/lib/couple.ts`. Still 404. The asymmetry was real but had a different cause (see Why This Works).

**Hypothesis 3 — JWT-specific path issue.** We tried to mint a fresh user JWT via `/auth/v1/signup`, hit `over_email_send_rate_limit`, and got blocked. As a diagnostic we granted EXECUTE to PUBLIC; anon-key probes then returned `400 not authenticated` (so the function body *was* running for anon now) — but the browser with a real user JWT *still* returned 404. That ruled out anything JWT-shape-specific and forced us to finally look at the response body.

## Solution

Hosted Supabase installs `pgcrypto` into the `extensions` schema, not `public`. Our SECURITY DEFINER functions had `set search_path = public`, which excluded `extensions` and made the unqualified `gen_random_bytes()` call unresolvable at runtime. Fix: include `extensions` in `search_path` on every SECURITY DEFINER function that touches pgcrypto/uuid-ossp/etc.

Hot fix applied via SQL:

```sql
alter function public.generate_invite_code()
  set search_path = public, extensions;

alter function public.redeem_invite_code(text)
  set search_path = public, extensions;

alter function public.handle_new_user()
  set search_path = public, extensions;
```

`supabase/migrations/0001_core.sql` was updated so future fresh applies are correct.

Before:

```sql
create or replace function public.generate_invite_code()
returns json
language plpgsql
security definer
set search_path = public          -- BUG: excludes `extensions` on hosted Supabase
as $$
declare
  v_code text;
begin
  ...
  v_code := upper(substr(translate(encode(gen_random_bytes(8), 'base64'),
                                   '+/=oOiIlL01', ''), 1, 6));   -- 42883 at runtime
  ...
end;
$$;
```

After:

```sql
create or replace function public.generate_invite_code()
returns json
language plpgsql
security definer
set search_path = public, extensions   -- FIX: pgcrypto lives in `extensions`
as $$
...
$$;
```

The migration also carries a comment block warning future readers:

```sql
-- search_path must include `extensions` so gen_random_bytes() resolves —
-- on hosted Supabase pgcrypto lives in the extensions schema, not public.
-- Without it, calls fail with SQLSTATE 42883 which PostgREST surfaces as
-- HTTP 404 (looks identical to "function not found"; very misleading).
```

Verification after the fix — anon curl now returns the expected ACL error, proving the function body is reachable for authenticated callers:

```
401 { "message": "permission denied for function generate_invite_code" }
```

The `/pair → 生成邀请码` flow succeeds end-to-end.

## Why This Works

**SQLSTATE 42883 → HTTP 404.** PostgREST translates Postgres error codes to HTTP status codes via a fixed table. `42883 undefined_function` maps to **404 Not Found**, the exact same status PostgREST returns when its schema cache genuinely doesn't know the function (PGRST202). At the HTTP layer the two failures are indistinguishable — only the response **body** carries the SQLSTATE that disambiguates them. That's why every cache-flush, GRANT, and DROP+CREATE we tried looked like a non-event: we were treating a runtime resolution error as a routing/visibility error.

**Why `pgcrypto` lives in `extensions`.** Hosted Supabase installs all extensions into a dedicated `extensions` schema rather than `public`, so user-owned objects in `public` stay clean and `public` doesn't accumulate extension cruft (and so Supabase can manage extension lifecycle independently). This is a hosted-Supabase convention; on a local Postgres `create extension pgcrypto` defaults to `public`, which is why this bug only bites on the hosted side.

**Why `set search_path = public` broke the call.** SECURITY DEFINER functions should pin `search_path` to defend against search-path hijacking attacks (a SECURITY DEFINER function with the caller's `search_path` can be tricked into executing attacker-owned objects). We did the right thing by pinning it — but pinned to the wrong set. With `search_path = public`, the unqualified identifier `gen_random_bytes` is looked up in `public` only, doesn't resolve, and Postgres raises 42883 at the moment that line executes.

**Why anon's symptom diverged from authenticated's.** PostgREST checks role-level EXECUTE permission *before* invoking the function. With anon lacking EXECUTE, the request short-circuited at the permission check (`401 permission denied for function ...`) and never entered the function body, so `gen_random_bytes` was never called and 42883 was never raised. Authenticated users had EXECUTE, entered the body, and triggered 42883 → 404. The asymmetry that looked like a per-role schema cache bug was just two different stages of the request pipeline failing for the two roles.

## Prevention

- **Read the response body first.** When PostgREST returns 404 on an RPC, open the body before reaching for cache theories. A `code` field starting with `42` is a Postgres SQLSTATE telling you the function ran (or tried to) — not a routing problem. Specifically: `42883` = undefined function, `42P01` = undefined table, `42501` = insufficient privilege. None of those are schema-cache issues.
- **Schema-qualify extension calls.** Prefer `extensions.gen_random_bytes(6)` over `gen_random_bytes(6)`. If the extension isn't installed, you get an immediate, *clearly worded* error at function-definition time or first call, instead of a runtime 42883 dressed up as HTTP 404.
- **If you pin `search_path`, include `extensions` on hosted Supabase.** Standard template for any SECURITY DEFINER function in this project:
  ```sql
  set search_path = public, extensions
  ```
  Anything less is a footgun the moment the function touches pgcrypto, uuid-ossp, pg_trgm, citext, etc.
- **Sanity-curl with the anon key when an RPC mysteriously 404s.** Asymmetric responses between anon and authenticated are diagnostic: anon hitting the ACL wall (401) while authenticated 404s means the function body is running and failing. That's a 30-second probe that would have skipped two hypotheses today.
- **Don't trust an adversarial-reviewer agent's confidence number over the response body.** The 0.78 endorsement of the per-role cache theory was directionally wrong because it reasoned from HTTP status alone. Ground-truth signals (response body, server logs) outrank model confidence.

## Related Issues

None — first solution doc in this repo.
