import { supabase } from '@/lib/supabase';

// O histórico do grupo: as viagens já feitas em que foram pelo menos duas pessoas do grupo. É para recordar — quem
// foi, as fotos, quanto se gastou — e para quem ficou em casa ver o que perdeu.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type GroupHistoryTrip = {
  sessionId: string;
  fixtureId: string;
  kickoffAt: string;
  /** Quem do grupo foi. */
  companions: string[];
  /** Quantas pessoas foram ao todo (do grupo ou não). */
  people: number;
  totalCents: number;
  photos: number;
  /** Link assinado da primeira foto do álbum, para a capa. */
  coverUrl: string | null;
};

export async function fetchGroupHistory(groupId: string): Promise<GroupHistoryTrip[]> {
  const { data, error } = await client().rpc('group_history', { p_group_id: groupId });
  if (error) throw error;
  const capas = data.flatMap((row) => (row.cover_path ? [row.cover_path] : []));
  const links: Record<string, string> = {};
  if (capas.length > 0) {
    const assinados = await client()
      .storage.from('trip-photos')
      .createSignedUrls(capas, 60 * 60);
    if (assinados.error) throw assinados.error;
    for (const item of assinados.data) {
      if (item.path && item.signedUrl) links[item.path] = item.signedUrl;
    }
  }
  return data.map((row) => ({
    sessionId: row.session_id,
    fixtureId: row.fixture_id,
    kickoffAt: row.kickoff_at,
    companions: row.companions ?? [],
    people: row.people ?? 0,
    totalCents: row.total_cents ?? 0,
    photos: row.photos ?? 0,
    coverUrl: row.cover_path ? (links[row.cover_path] ?? null) : null,
  }));
}
