import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface SessionState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  setSession: (session) => set({ session, user: session?.user ?? null, isLoading: false }),
}));

/** Wire Supabase auth events into the store. Call once at app boot. */
export function bootstrapSession() {
  void supabase.auth.getSession().then(({ data }) => {
    useSessionStore.getState().setSession(data.session);
  });

  const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
    useSessionStore.getState().setSession(session);
  });

  return () => subscription.subscription.unsubscribe();
}
