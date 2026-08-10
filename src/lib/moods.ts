import { z } from 'zod';
import { supabase } from './supabase';

export interface Mood {
  id: string;
  couple_id: string;
  user_id: string;
  date: string;
  emoji: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export const moodInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式错了'),
  emoji: z.string().min(1).max(32),
  note: z.string().trim().max(500, '备注太长').optional(),
});
export type MoodInput = z.infer<typeof moodInputSchema>;

/**
 * A day recorded with words but no photo. `emoji` is NOT NULL in the schema and
 * doubles as "what kind of entry is this", so text-only days get their own key
 * rather than an empty string — the week strip renders it as an ink-stroke
 * glyph via <MoodIcon>.
 *
 * The twelve hand-drawn smileys that used to be pickable are gone from the UI
 * (M4: the check-in became a diary), but <MoodIcon> still maps their keys so
 * historical rows keep rendering.
 */
export const NOTE_EMOJI = 'note';

async function currentContext(): Promise<{ userId: string; coupleId: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');
  const { data, error } = await supabase
    .from('users')
    .select('couple_id')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  if (!data?.couple_id) throw new Error('no couple yet');
  return { userId: user.id, coupleId: data.couple_id };
}

/** Returns YYYY-MM-DD in the user's local timezone. */
export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Returns YYYY-MM-DD strings for the last N days, oldest → newest. */
export function recentDates(days: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return out;
}

/** Both partners' moods for the last N days. RLS scopes to caller's couple. */
export async function fetchRecentMoods(days = 7): Promise<Mood[]> {
  const since = recentDates(days)[0];
  const { data, error } = await supabase
    .from('moods')
    .select('*')
    .gte('date', since)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Mood[];
}

/** Resolve the partner's user-row metadata. RLS lets us read both partners' rows. */
export async function fetchPartner(): Promise<PartnerProfile | null> {
  const { userId } = await currentContext();
  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .neq('id', userId);
  if (error) throw error;
  return (data?.[0] as PartnerProfile | undefined) ?? null;
}

/** Insert or update today's (or any date's) mood for the current user. */
export async function upsertMyMood(input: MoodInput): Promise<Mood> {
  const parsed = moodInputSchema.parse(input);
  const { userId, coupleId } = await currentContext();
  const { data, error } = await supabase
    .from('moods')
    .upsert(
      {
        couple_id: coupleId,
        user_id: userId,
        date: parsed.date,
        emoji: parsed.emoji,
        note: parsed.note ?? null,
      },
      { onConflict: 'user_id,date' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as Mood;
}
