import { supabase } from './supabase';
import { monthBoundaries } from './dates';
import { getThemeCoverSignedUrl, type MonthlyTheme } from './themes';
import type { Wish } from './wishes';
import type { Mood } from './moods';
import type { MediaItem } from './memories';
import type { TimeCapsule } from './time-capsules';

export interface SummaryStats {
  wishesDoneCount: number;
  myCheckIns: number;
  partnerCheckIns: number;
  daysWithBothCheckedIn: number;
  photoCount: number;
  capsulesBuriedCount: number;
  capsulesOpenedCount: number;
}

export interface MonthlySummary {
  yearMonth: string;
  year: number;
  /** 0-indexed month for Date constructors. */
  monthIndex: number;
  daysInMonth: number;
  theme: MonthlyTheme | null;
  coverSignedUrl: string | null;
  wishes: Wish[];
  moods: Mood[];
  mediaItems: MediaItem[];
  capsules: TimeCapsule[];
  partnerId: string | null;
  partnerName: string | null;
  myUserId: string;
  coupleId: string | null;
  stats: SummaryStats;
}

/**
 * Assemble all data for a single month's summary in one round trip
 * (parallel queries). Stats are computed in-memory.
 *
 * RLS handles couple scoping automatically — no `couple_id` filters here.
 */
export async function fetchMonthlySummary(
  yearMonth: string,
  myUserId: string,
): Promise<MonthlySummary> {
  const b = monthBoundaries(yearMonth);

  const [themeR, wishesR, moodsR, mediaR, capsulesR, partnerR] = await Promise.all([
    supabase
      .from('monthly_themes')
      .select('*')
      .eq('year_month', yearMonth)
      .maybeSingle(),
    supabase
      .from('wishes')
      .select('*')
      .eq('status', 'done')
      .gte('completed_at', b.monthStart)
      .lt('completed_at', b.monthEnd)
      .order('completed_at', { ascending: true }),
    supabase
      .from('moods')
      .select('*')
      .gte('date', b.monthStartDate)
      .lte('date', b.monthEndDate)
      .order('date', { ascending: true }),
    supabase
      .from('media_items')
      .select('*')
      .gte('taken_at', b.monthStart)
      .lt('taken_at', b.monthEnd)
      .order('taken_at', { ascending: true }),
    supabase
      .from('time_capsules')
      .select('*')
      .or(
        `and(created_at.gte.${b.monthStart},created_at.lt.${b.monthEnd}),` +
          `and(opened_at.gte.${b.monthStart},opened_at.lt.${b.monthEnd})`,
      ),
    supabase
      .from('users')
      .select('id, display_name')
      .neq('id', myUserId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (themeR.error) throw themeR.error;
  if (wishesR.error) throw wishesR.error;
  if (moodsR.error) throw moodsR.error;
  if (mediaR.error) throw mediaR.error;
  if (capsulesR.error) throw capsulesR.error;
  // partnerR may legitimately have no row pre-pairing — don't throw.

  const theme = (themeR.data as MonthlyTheme | null) ?? null;
  const wishes = (wishesR.data ?? []) as Wish[];
  const moods = (moodsR.data ?? []) as Mood[];
  const mediaItems = (mediaR.data ?? []) as MediaItem[];
  const capsules = (capsulesR.data ?? []) as TimeCapsule[];

  const coupleId =
    theme?.couple_id ??
    moods[0]?.couple_id ??
    wishes[0]?.couple_id ??
    mediaItems[0]?.couple_id ??
    capsules[0]?.couple_id ??
    null;

  const partnerId = (partnerR.data?.id as string | undefined) ?? null;
  const partnerName = (partnerR.data?.display_name as string | undefined) ?? null;

  const coverSignedUrl = theme?.cover_url
    ? await getThemeCoverSignedUrl(theme.cover_url).catch(() => null)
    : null;

  // ---- Stats ---------------------------------------------------------------
  const myDates = new Set<string>();
  const partnerDates = new Set<string>();
  for (const m of moods) {
    if (m.user_id === myUserId) myDates.add(m.date);
    else if (partnerId && m.user_id === partnerId) partnerDates.add(m.date);
  }
  const daysWithBothCheckedIn = [...myDates].filter((d) => partnerDates.has(d)).length;

  const startMs = new Date(b.monthStart).getTime();
  const endMs = new Date(b.monthEnd).getTime();

  const capsulesBuriedCount = capsules.filter((c) => {
    const ts = new Date(c.created_at).getTime();
    return ts >= startMs && ts < endMs;
  }).length;
  const capsulesOpenedCount = capsules.filter((c) => {
    if (!c.opened_at) return false;
    const ts = new Date(c.opened_at).getTime();
    return ts >= startMs && ts < endMs;
  }).length;

  const stats: SummaryStats = {
    wishesDoneCount: wishes.length,
    myCheckIns: myDates.size,
    partnerCheckIns: partnerDates.size,
    daysWithBothCheckedIn,
    photoCount: mediaItems.length,
    capsulesBuriedCount,
    capsulesOpenedCount,
  };

  return {
    yearMonth,
    year: b.year,
    monthIndex: b.month - 1,
    daysInMonth: b.daysInMonth,
    theme,
    coverSignedUrl,
    wishes,
    moods,
    mediaItems,
    capsules,
    partnerId,
    partnerName,
    myUserId,
    coupleId,
    stats,
  };
}

export { getBatchSignedUrls } from './storage';
