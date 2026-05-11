import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

const BUCKET = 'memories';

/**
 * Selfie mood — when stored, `moods.emoji = 'selfie'`. The actual photo lives
 * at a deterministic path in the memories bucket so we can resolve it from
 * (couple_id, user_id, date) without a schema change.
 *
 * Path: {couple_id}/moods/{user_id}-{date}.jpg
 *
 * Upload uses upsert=true so retaking same-day overwrites cleanly.
 */
export const SELFIE_EMOJI = 'selfie';

export function selfiePath(coupleId: string, userId: string, date: string): string {
  return `${coupleId}/moods/${userId}-${date}.jpg`;
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

export async function uploadMoodSelfie(file: File, date: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请用一张照片');
  const { userId, coupleId } = await currentContext();
  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
  });
  const path = selfiePath(coupleId, userId, date);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  if (error) throw error;
  return path;
}

export async function getMoodSelfieSignedUrl(path: string, expiresIn = 60 * 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
