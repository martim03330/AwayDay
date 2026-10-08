import { fotoParaEnviar } from '@/lib/foto-para-enviar';
import { supabase } from '@/lib/supabase';

// As recordações de uma viagem: quem foi, quanto se gastou (e a maior extravagância) e o álbum. As fotos são de quem
// foi; vêem-nas quem foi e a malta dos grupos que tiveram pelo menos duas pessoas na viagem. Balde privado, uma pasta
// por sessão.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

const BALDE = 'trip-photos';

export type TripMemory = {
  sessionId: string;
  name: string;
  fixtureId: string;
  kickoffAt: string;
  peopleNames: string[];
  totalCents: number;
  expenses: number;
  /** A maior despesa lançada à mão (a da boleia não conta). */
  biggest: { description: string; cents: number } | null;
  photos: number;
  /** Foste: podes pôr fotos. */
  iWent: boolean;
};

export async function fetchTripMemory(sessionId: string): Promise<TripMemory | null> {
  const { data, error } = await client().rpc('trip_memory', { p_session_id: sessionId });
  if (error) throw error;
  const row = data[0];
  if (!row) return null;
  return {
    sessionId: row.session_id,
    name: row.name ?? 'A viagem',
    fixtureId: row.fixture_id,
    kickoffAt: row.kickoff_at,
    peopleNames: row.people_names ?? [],
    totalCents: row.total_cents ?? 0,
    expenses: row.expenses ?? 0,
    biggest:
      row.biggest_description && row.biggest_cents !== null
        ? { description: row.biggest_description, cents: row.biggest_cents }
        : null,
    photos: row.photos ?? 0,
    iWent: row.i_went === true,
  };
}

export type TripPhoto = {
  id: string;
  profileId: string;
  displayName: string;
  url: string | null;
  caption: string | null;
  createdAt: string;
  mine: boolean;
};

export async function fetchTripPhotos(sessionId: string): Promise<TripPhoto[]> {
  const { data, error } = await client().rpc('trip_photos', { p_session_id: sessionId });
  if (error) throw error;
  const caminhos = data.map((row) => row.storage_path);
  const links: Record<string, string> = {};
  if (caminhos.length > 0) {
    const assinados = await client()
      .storage.from(BALDE)
      .createSignedUrls(caminhos, 60 * 60);
    if (assinados.error) throw assinados.error;
    for (const item of assinados.data) {
      if (item.path && item.signedUrl) links[item.path] = item.signedUrl;
    }
  }
  return data.map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    displayName: row.display_name ?? 'Um adepto',
    url: links[row.storage_path] ?? null,
    caption: row.caption,
    createdAt: row.created_at,
    mine: row.mine === true,
  }));
}

/** Sobe uma foto para o álbum da viagem. Só quem foi. */
export async function addTripPhoto(
  sessionId: string,
  input: { uri: string; mimeType: string },
  caption?: string
) {
  // Re-encoded without metadata (no GPS from where the photo was taken), so always JPEG.
  const { bytes, mimeType } = await fotoParaEnviar(input.uri);
  const caminho = `${sessionId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`;
  const subida = await client()
    .storage.from(BALDE)
    .upload(caminho, bytes, { contentType: mimeType, upsert: false });
  if (subida.error) throw subida.error;
  const { error } = await client().rpc('add_trip_photo', {
    p_session_id: sessionId,
    p_path: caminho,
    p_caption: caption?.trim() || undefined,
  });
  if (error) {
    await client()
      .storage.from(BALDE)
      .remove([caminho])
      .catch(() => undefined);
    throw error;
  }
}

export async function removeTripPhoto(photoId: string) {
  const { data, error } = await client().rpc('remove_trip_photo', { p_photo_id: photoId });
  if (error) throw error;
  if (data)
    await client()
      .storage.from(BALDE)
      .remove([data])
      .catch(() => undefined);
}
