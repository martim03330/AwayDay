import { corpoDoErroDaFuncao } from '@/lib/erros-funcoes';
import { supabase } from '@/lib/supabase';

// Streets and places by name (OpenStreetMap, through the `rides` Edge Function, which caches and rate-limits them).
// Shared by the ride meeting point and the tasco suggestion: no API key ever reaches the app (rule 3).

export type PlaceResult = {
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
  /** Straight line from where the search was centred, when it was. */
  distanceM: number | null;
};

export class PlaceSearchRefused extends Error {
  readonly reason: 'rate_limited' | 'unknown';

  constructor(reason: 'rate_limited' | 'unknown') {
    super(reason);
    this.name = 'PlaceSearchRefused';
    this.reason = reason;
  }
}

/** Streets and places matching `query`, nearest to `near` first. */
export async function searchPlace(
  query: string,
  near: { latitude: number; longitude: number } | null
): Promise<PlaceResult[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('rides', {
    body: { action: 'search', query, near },
  });
  if (error) {
    const body = await corpoDoErroDaFuncao(error);
    throw new PlaceSearchRefused(body?.error === 'rate_limited' ? 'rate_limited' : 'unknown');
  }
  const results: unknown[] =
    typeof data === 'object' && data !== null && Array.isArray(Reflect.get(data, 'results'))
      ? Reflect.get(data, 'results')
      : [];
  return results.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const name = Reflect.get(item, 'name');
    const detail = Reflect.get(item, 'detail');
    const latitude = Reflect.get(item, 'latitude');
    const longitude = Reflect.get(item, 'longitude');
    const distance = Reflect.get(item, 'distance_m');
    if (typeof name !== 'string' || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return [];
    }
    return [
      {
        name,
        detail: typeof detail === 'string' ? detail : '',
        latitude,
        longitude,
        distanceM: typeof distance === 'number' ? distance : null,
      },
    ];
  });
}
