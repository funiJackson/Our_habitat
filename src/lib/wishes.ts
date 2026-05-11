import { z } from 'zod';
import { supabase } from './supabase';

export type WishStatus = 'todo' | 'done';

export interface Wish {
  id: string;
  couple_id: string;
  created_by: string;
  title: string;
  note: string | null;
  status: WishStatus;
  completed_at: string | null;
  completed_by: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const wishInputSchema = z.object({
  title: z.string().trim().min(1, '愿望不能为空').max(200, '太长啦'),
  note: z.string().trim().max(2000, '备注太长').optional(),
});
export type WishInput = z.infer<typeof wishInputSchema>;

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

export async function listWishes(): Promise<Wish[]> {
  const { data, error } = await supabase
    .from('wishes')
    .select('*')
    .order('status', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Wish[];
}

/**
 * Persist a new top-down ordering for the caller's couple. Pass IDs in the
 * desired display order — the RPC assigns sort_order = array index, scoped
 * to the caller's couple via current_user_couple_id().
 */
export async function reorderWishes(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const { error } = await supabase.rpc('reorder_wishes', { p_ids: orderedIds });
  if (error) throw error;
}

export async function createWish(input: WishInput): Promise<Wish> {
  const parsed = wishInputSchema.parse(input);
  const { userId, coupleId } = await currentContext();
  const { data, error } = await supabase
    .from('wishes')
    .insert({
      couple_id: coupleId,
      created_by: userId,
      title: parsed.title,
      note: parsed.note ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Wish;
}

export async function setWishStatus(id: string, next: WishStatus): Promise<Wish> {
  const { userId } = await currentContext();
  const patch =
    next === 'done'
      ? { status: 'done' as const, completed_at: new Date().toISOString(), completed_by: userId }
      : { status: 'todo' as const, completed_at: null, completed_by: null };
  const { data, error } = await supabase
    .from('wishes')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Wish;
}

export async function deleteWish(id: string): Promise<void> {
  const { error } = await supabase.from('wishes').delete().eq('id', id);
  if (error) throw error;
}
