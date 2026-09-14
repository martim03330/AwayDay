import { parseStats } from '@/features/recap/stats';
import type { SeasonRecap } from '@/features/recap/types';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

/** The user's most recent season recap, or `null`. Written by the server; RLS returns only the user's own. */
export async function fetchLatestRecap(userId: string): Promise<SeasonRecap | null> {
  const { data, error } = await client()
    .from('season_recap')
    .select('id, season_id, headline, body, stats, created_at, shared_at')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    seasonId: data.season_id,
    headline: data.headline,
    body: data.body,
    stats: parseStats(data.stats),
    createdAt: data.created_at,
    sharedAt: data.shared_at,
  };
}

/** Remembers that the recap was shared (the only change clients may make). */
export async function markRecapShared(recapId: string) {
  const { error } = await client()
    .from('season_recap')
    .update({ shared_at: new Date().toISOString() })
    .eq('id', recapId);
  if (error) throw error;
}
