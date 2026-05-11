import { supabase } from './supabase';

export interface InviteCode {
  code: string;
  expires_at: string;
}

/** Generate a fresh invite code for the current user's couple. */
export async function generateInviteCode(): Promise<InviteCode> {
  const { data, error } = await supabase.rpc('generate_invite_code');
  if (error) throw error;
  return data as InviteCode;
}

/** Redeem an invite code and pair this user into the couple. Atomic on the server. */
export async function redeemInviteCode(code: string): Promise<{ couple_id: string }> {
  const normalized = code.trim().toUpperCase();
  const { data, error } = await supabase.rpc('redeem_invite_code', { p_code: normalized });
  if (error) throw error;
  return data as { couple_id: string };
}

export interface CoupleSnapshot {
  id: string;
  owner_id: string;
  partner_id: string | null;
  anniversary: string | null;
  unbinding_at: string | null;
}

/** Fetch the current user's couple (or null if not paired yet). */
export async function fetchMyCouple(): Promise<CoupleSnapshot | null> {
  // Filter by id explicitly — after pairing, RLS lets the caller see both
  // partners' user rows, so an unfiltered .single() returns 2 rows and throws.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('couple_id')
    .eq('id', user.id)
    .single();
  if (profileError) throw profileError;

  const coupleId = profile?.couple_id;
  if (!coupleId) return null;

  const { data, error } = await supabase
    .from('couples')
    .select('id, owner_id, partner_id, anniversary, unbinding_at')
    .eq('id', coupleId)
    .single();
  if (error) throw error;

  return data;
}
