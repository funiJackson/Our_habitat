import { z } from 'zod';
import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

export type CapsuleKind = 'text' | 'audio' | 'image';

export interface TimeCapsule {
  id: string;
  couple_id: string;
  sender_id: string;
  recipient_id: string;
  kind: CapsuleKind;
  content_text: string | null;
  storage_path: string | null;
  unlock_at: string;
  opened_at: string | null;
  notified: boolean;
  created_at: string;
}

const CAPSULES_BUCKET = 'capsules';

export const capsuleTextSchema = z.object({
  kind: z.literal('text'),
  recipient_id: z.string().uuid(),
  content_text: z.string().trim().min(1, '写点什么吧').max(5000, '太长啦'),
  unlock_at: z.string().min(1, '选个解锁时间'),
});

export const capsuleImageSchema = z.object({
  kind: z.literal('image'),
  recipient_id: z.string().uuid(),
  file: z.instanceof(File, { message: '选张图片' }),
  unlock_at: z.string().min(1, '选个解锁时间'),
});

export type CapsuleTextInput = z.infer<typeof capsuleTextSchema>;
export type CapsuleImageInput = z.infer<typeof capsuleImageSchema>;

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

/** Convert <input type="datetime-local"> value (local, no tz) to ISO. */
export function localDatetimeToIso(local: string): string {
  return new Date(local).toISOString();
}

/** All capsules visible to the caller per RLS (sender always; recipient only after unlock). */
export async function listCapsules(): Promise<TimeCapsule[]> {
  const { data, error } = await supabase
    .from('time_capsules')
    .select('*')
    .order('unlock_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TimeCapsule[];
}

/** Time-limited URL for displaying a capsule's image attachment. */
export async function getCapsuleSignedUrl(path: string, expiresIn = 60 * 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CAPSULES_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function createTextCapsule(input: CapsuleTextInput): Promise<TimeCapsule> {
  const parsed = capsuleTextSchema.parse(input);
  const { userId, coupleId } = await currentContext();
  const { data, error } = await supabase
    .from('time_capsules')
    .insert({
      couple_id: coupleId,
      sender_id: userId,
      recipient_id: parsed.recipient_id,
      kind: 'text' as const,
      content_text: parsed.content_text,
      unlock_at: localDatetimeToIso(parsed.unlock_at),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as TimeCapsule;
}

export async function createImageCapsule(input: CapsuleImageInput): Promise<TimeCapsule> {
  const parsed = capsuleImageSchema.parse(input);
  const { userId, coupleId } = await currentContext();

  if (!parsed.file.type.startsWith('image/')) {
    throw new Error('only photos for now');
  }
  const compressed = await imageCompression(parsed.file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 2400,
    useWebWorker: true,
  });
  const ext = (parsed.file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const id = crypto.randomUUID();
  const storagePath = `${coupleId}/${id}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(CAPSULES_BUCKET)
    .upload(storagePath, compressed, {
      contentType: compressed.type || parsed.file.type,
      upsert: false,
    });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from('time_capsules')
    .insert({
      id,
      couple_id: coupleId,
      sender_id: userId,
      recipient_id: parsed.recipient_id,
      kind: 'image' as const,
      storage_path: storagePath,
      unlock_at: localDatetimeToIso(parsed.unlock_at),
    })
    .select('*')
    .single();
  if (error) {
    void supabase.storage.from(CAPSULES_BUCKET).remove([storagePath]);
    throw error;
  }
  return data as TimeCapsule;
}

/** Recipient marks an unlocked capsule as opened. RLS enforces unlock_at <= now(). */
export async function markCapsuleOpened(id: string): Promise<TimeCapsule> {
  const { data, error } = await supabase
    .from('time_capsules')
    .update({ opened_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as TimeCapsule;
}

/** Sender deletes a still-locked capsule (regret window). RLS enforces unlock_at > now(). */
export async function deleteLockedCapsule(c: TimeCapsule): Promise<void> {
  const { error } = await supabase.from('time_capsules').delete().eq('id', c.id);
  if (error) throw error;
  if (c.storage_path) {
    await supabase.storage.from(CAPSULES_BUCKET).remove([c.storage_path]);
  }
}
