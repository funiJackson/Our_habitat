import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

export type MediaKind = 'photo' | 'video';

export interface MediaItem {
  id: string;
  couple_id: string;
  album_id: string | null;
  uploaded_by: string;
  kind: MediaKind;
  storage_path: string;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  taken_at: string;
  location: unknown;
  description: string | null;
  tags: string[];
  created_at: string;
}

const MEMORIES_BUCKET = 'memories';

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

/** All photos for the current couple, newest taken_at first. */
export async function listMedia(): Promise<MediaItem[]> {
  const { data, error } = await supabase
    .from('media_items')
    .select('*')
    .order('taken_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MediaItem[];
}

/** Time-limited URL for displaying a private storage object. */
export async function getSignedUrl(path: string, expiresIn = 60 * 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from(MEMORIES_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Compress, upload, and insert a media_items row. Generates a small
 * thumbnail alongside the full image so grid views don't have to fetch
 * the 2MB original — the thumb is ~10× smaller and renders snappily.
 */
export async function uploadPhoto(
  file: File,
  opts: { description?: string } = {},
): Promise<MediaItem> {
  if (!file.type.startsWith('image/')) {
    throw new Error('only photos for now');
  }
  const { userId, coupleId } = await currentContext();

  // Original — kept as the lightbox/full-screen source.
  const full = await imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 2400,
    useWebWorker: true,
  });

  // Thumbnail — used by grid, timeline, photo wall.
  const thumb = await imageCompression(file, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 600,
    useWebWorker: true,
  });

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const id = crypto.randomUUID();
  const storagePath = `${coupleId}/${id}.${ext}`;
  const thumbPath = `${coupleId}/thumbs/${id}.${ext}`;

  const [fullUp, thumbUp] = await Promise.all([
    supabase.storage.from(MEMORIES_BUCKET).upload(storagePath, full, {
      contentType: full.type || file.type,
      upsert: false,
    }),
    supabase.storage.from(MEMORIES_BUCKET).upload(thumbPath, thumb, {
      contentType: thumb.type || file.type,
      upsert: false,
    }),
  ]);
  if (fullUp.error) throw fullUp.error;
  if (thumbUp.error) {
    // Original got in but thumb didn't — clean up the original to keep state consistent.
    void supabase.storage.from(MEMORIES_BUCKET).remove([storagePath]);
    throw thumbUp.error;
  }

  const dimensions = await readImageDimensions(full).catch(() => null);

  const { data, error } = await supabase
    .from('media_items')
    .insert({
      id,
      couple_id: coupleId,
      uploaded_by: userId,
      kind: 'photo' as const,
      storage_path: storagePath,
      thumb_path: thumbPath,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      taken_at: new Date(file.lastModified || Date.now()).toISOString(),
      description: opts.description?.trim() || null,
    })
    .select('*')
    .single();

  if (error) {
    void supabase.storage.from(MEMORIES_BUCKET).remove([storagePath, thumbPath]);
    throw error;
  }
  return data as MediaItem;
}

/** Delete the DB row plus the full and (if present) thumb objects. */
export async function deleteMedia(item: MediaItem): Promise<void> {
  const { error: dbErr } = await supabase.from('media_items').delete().eq('id', item.id);
  if (dbErr) throw dbErr;
  const paths = [item.storage_path];
  if (item.thumb_path) paths.push(item.thumb_path);
  await supabase.storage.from(MEMORIES_BUCKET).remove(paths);
}

function readImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
