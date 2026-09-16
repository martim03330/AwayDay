import { supabase } from '@/lib/supabase';

// Carimbos de estádio. Os que valem para o ranking são os confirmados no local, em dia de jogo: a app lê a posição
// uma vez e o servidor confirma a distância. A posição não é guardada — fica o estádio, o jogo e o dia.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type StampRefusal =
  | 'not_signed_in'
  | 'bad_location'
  | 'fixture_not_found'
  | 'outside_window'
  | 'too_far'
  | 'rate_limited'
  | 'unknown';

export class StampRefused extends Error {
  readonly reason: StampRefusal;

  constructor(reason: StampRefusal) {
    super(reason);
    this.name = 'StampRefused';
    this.reason = reason;
  }
}

const RECUSAS: StampRefusal[] = [
  'not_signed_in',
  'bad_location',
  'fixture_not_found',
  'outside_window',
  'too_far',
  'rate_limited',
];

function refusal(error: { message: string }) {
  return new StampRefused(RECUSAS.find((reason) => error.message === reason) ?? 'unknown');
}

/** Um estádio carimbado no local, e quantas vezes. */
export type StadiumStamp = {
  venueId: string;
  visits: number;
  lastVisit: string;
};

export type RankingRow = {
  profileId: string;
  displayName: string;
  stadiums: number;
  visits: number;
  isMe: boolean;
};

/**
 * Carimba o estádio, estando lá. Devolve a que distância estavas, arredondada a 100 m — é o que a app mostra quando
 * corre bem, e o que explica a recusa quando estás longe de mais.
 */
export async function stampStadium(
  fixtureId: string,
  here: { latitude: number; longitude: number }
): Promise<number> {
  const { data, error } = await client().rpc('stamp_stadium', {
    p_fixture_id: fixtureId,
    p_latitude: here.latitude,
    p_longitude: here.longitude,
  });
  if (error) throw refusal(error);
  return data ?? 0;
}

/** Os teus carimbos verificados, por estádio. */
export async function fetchMyStamps(): Promise<StadiumStamp[]> {
  const { data, error } = await client().rpc('my_stadium_stamps');
  if (error) throw error;
  return data.flatMap((row) =>
    row.venue_id
      ? [
          {
            venueId: row.venue_id,
            visits: row.visits ?? 0,
            lastVisit: row.last_visit ?? '',
          },
        ]
      : []
  );
}

/** Ranking público de estádios carimbados. Só aparece quem escolheu aparecer, mais tu. */
export async function fetchStadiumRanking(limit = 20): Promise<RankingRow[]> {
  const { data, error } = await client().rpc('stadium_ranking', { p_limit: limit });
  if (error) throw error;
  return data.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name ?? 'Um adepto',
    stadiums: row.stadiums ?? 0,
    visits: row.visits ?? 0,
    isMe: row.is_me === true,
  }));
}
