import { z } from 'zod';
import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

export interface MonthlyTheme {
  id: string;
  couple_id: string;
  year_month: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const themeInputSchema = z.object({
  title: z.string().trim().min(1, '主题不能为空').max(100, '太长啦'),
  description: z.string().trim().max(500, '描述太长').optional(),
});
export type ThemeInput = z.infer<typeof themeInputSchema>;

/** YYYY-MM string in local time. */
export function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

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

/** The current month's theme for the caller's couple, or null. */
export async function fetchCurrentTheme(): Promise<MonthlyTheme | null> {
  const ym = currentYearMonth();
  const { data, error } = await supabase
    .from('monthly_themes')
    .select('*')
    .eq('year_month', ym)
    .maybeSingle();
  if (error) throw error;
  return (data as MonthlyTheme | null) ?? null;
}

/**
 * Insert or update the current month's theme. Two-step (select then insert/update)
 * rather than upsert to preserve `created_by` on update.
 */
export async function upsertCurrentTheme(input: ThemeInput): Promise<MonthlyTheme> {
  const parsed = themeInputSchema.parse(input);
  const { userId, coupleId } = await currentContext();
  const ym = currentYearMonth();
  const existing = await fetchCurrentTheme();

  if (existing) {
    const { data, error } = await supabase
      .from('monthly_themes')
      .update({
        title: parsed.title,
        description: parsed.description ?? null,
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data as MonthlyTheme;
  }

  const { data, error } = await supabase
    .from('monthly_themes')
    .insert({
      couple_id: coupleId,
      year_month: ym,
      title: parsed.title,
      description: parsed.description ?? null,
      created_by: userId,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as MonthlyTheme;
}

// ===========================================================================
// Cover image upload
// ===========================================================================
//
// Reuses the `memories` storage bucket — its policy only requires the path's
// first folder segment to equal couple_id, which our path satisfies. We don't
// surface these objects in the memories grid (that grid lists from
// `media_items`, not raw storage), so they stay invisible there.
// ===========================================================================

const COVERS_BUCKET = 'memories';
const COVERS_PREFIX = 'themes';

/** Upload a new cover image, attach it to the theme, and best-effort remove the old one. */
export async function uploadThemeCover(theme: MonthlyTheme, file: File): Promise<MonthlyTheme> {
  if (!file.type.startsWith('image/')) {
    throw new Error('only photos for now');
  }
  const { coupleId } = await currentContext();
  if (theme.couple_id !== coupleId) {
    throw new Error('not your theme');
  }

  const compressed = await imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 2400,
    useWebWorker: true,
  });

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const storagePath = `${coupleId}/${COVERS_PREFIX}/${theme.id}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(COVERS_BUCKET)
    .upload(storagePath, compressed, {
      contentType: compressed.type || file.type,
      upsert: false,
    });
  if (upErr) throw upErr;

  const previous = theme.cover_url;

  const { data, error } = await supabase
    .from('monthly_themes')
    .update({ cover_url: storagePath })
    .eq('id', theme.id)
    .select('*')
    .single();
  if (error) {
    void supabase.storage.from(COVERS_BUCKET).remove([storagePath]);
    throw error;
  }

  if (previous && previous !== storagePath) {
    void supabase.storage.from(COVERS_BUCKET).remove([previous]);
  }

  return data as MonthlyTheme;
}

/** Time-limited URL for displaying a private cover image. */
export async function getThemeCoverSignedUrl(path: string, expiresIn = 60 * 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from(COVERS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
