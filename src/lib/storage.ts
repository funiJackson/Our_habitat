import { supabase } from './supabase';

export type StorageBucket = 'memories' | 'capsules';

/**
 * Resolve signed URLs for many storage objects in one round trip.
 * Use this instead of N parallel `createSignedUrl` calls when rendering grids.
 */
export async function getBatchSignedUrls(
  bucket: StorageBucket,
  paths: string[],
  expiresIn = 60 * 60,
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      map.set(item.path, item.signedUrl);
    }
  }
  return map;
}
