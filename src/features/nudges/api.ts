import type { NudgeItem } from '@/features/nudges/types';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

/** The user's latest suggestions. RLS only returns their own; they are written by the server. */
export async function fetchMyNudges(userId: string): Promise<NudgeItem[]> {
  const { data, error } = await client()
    .from('nudge')
    .select('id, body, created_at, read_at')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
}

/** Marks every unread suggestion as read (the only change clients may make). */
export async function markNudgesRead(userId: string) {
  const { error } = await client()
    .from('nudge')
    .update({ read_at: new Date().toISOString() })
    .eq('profile_id', userId)
    .is('read_at', null);
  if (error) throw error;
}
