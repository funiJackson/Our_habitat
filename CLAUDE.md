# Sandz — agent notes

Private app for two (Laura + partner). Mobile-first PWA, deployed via `git push`. Not for App Store. Two-user scope: don't suggest multi-tenant abstractions, public OAuth providers, or compliance scaffolding for distribution.

Stack: Vite + React 19 + TS + Tailwind 4 + Supabase (hosted) + Zustand + React Query.

## Supabase conventions

These are project-specific gotchas that have already cost time. Honor them.

### `pgcrypto` lives in the `extensions` schema, not `public`

On hosted Supabase, all extensions live in a dedicated `extensions` schema. Any SECURITY DEFINER function that pins `search_path` MUST include `extensions`, otherwise calls like `gen_random_bytes()` raise SQLSTATE `42883` — and **PostgREST translates `42883` to HTTP 404**, indistinguishable from "function not in schema cache." This wasted ~an hour on 2026-05-09. See `docs/solutions/database-issues/pgcrypto-search-path-rpc-404-2026-05-09.md`.

Standard template for SECURITY DEFINER functions in this repo:

```sql
create function public.foo()
returns ...
language plpgsql
security definer
set search_path = public, extensions   -- always both
as $$ ... $$;
```

Or schema-qualify: `extensions.gen_random_bytes(...)`.

### Debugging PostgREST RPC errors

When `/rest/v1/rpc/<name>` returns a non-200, **read the response body first** before reaching for cache theories. The `code` field is a Postgres SQLSTATE:

- `42883` undefined function (often a `search_path` issue) → 404
- `42P01` undefined table → 404
- `42501` insufficient privilege → 401
- `P0001` `raise exception` from inside the function → 400
- `PGRST202` actual schema cache miss → 404

The 404s look identical at the HTTP layer. The body disambiguates.

Curl probe with anon key alone is a 30-second diagnostic: if anon gets 401 and authenticated gets 404, the function body is running and failing for authenticated — focus there.

### Migration workflow

- Source of truth: `supabase/migrations/*.sql`
- Apply via `mcp__supabase__apply_migration` (MCP tool) for hosted dev, or Dashboard SQL Editor manually.
- After DDL changes, `notify pgrst, 'reload schema'` is usually unnecessary — direct DDL invalidates PostgREST's cache. Reach for it only when something looks stale.
- `supabase/migrations/0003_storage.sql` requires the project's Storage service to be initialized first (visit Dashboard → Storage once).

### RLS / pairing model

`couple_id` is the single tenancy edge. RLS scopes via `public.current_user_couple_id()`. Pairing happens through SECURITY DEFINER RPCs (`generate_invite_code`, `redeem_invite_code`) — clients never UPDATE `couples` or INSERT `invite_codes` directly.

## Documented solutions

`docs/solutions/` — past problems and their fixes, organized by category with YAML frontmatter (`module`, `tags`, `problem_type`). Relevant when implementing or debugging in documented areas; grep by tag is faster than re-deriving from scratch.
