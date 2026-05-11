import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when both env vars are present and non-placeholder. */
export const isSupabaseConfigured =
  Boolean(url) &&
  Boolean(anonKey) &&
  !url.includes('YOUR-PROJECT-REF') &&
  !anonKey.includes('YOUR-ANON-KEY');

// Note: client is intentionally untyped at M0. Once your Supabase project is
// up and you've run `npm run supabase:types`, add the generic back:
//   createClient<Database>(url, anonKey, { ... })
//
// When env vars are missing we still create a client with empty strings so
// the rest of the app can import it; calls will fail at runtime, but the
// SetupGate will render before any Supabase call happens.
export const supabase: SupabaseClient = createClient(
  url || 'http://localhost:54321',
  anonKey || 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'sandz-auth',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  },
);
