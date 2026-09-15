import type { Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

// Match-day parking per stadium, from researched sources. Static information: no free source publishes how full car
// parks are.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type ParkingSource = { url: string; title: string };

export type ParkingKind =
  'parque_oficial' | 'parque_publico' | 'parque_gratuito' | 'rua' | 'park_and_ride';

export type ParkingSpot = {
  id: string;
  name: string;
  kind: ParkingKind;
  address: string | null;
  operator: string | null;
  location: { latitude: number; longitude: number } | null;
  distanceM: number | null;
  /** `null` when no source says. */
  openOnMatchdays: boolean | null;
  priceNote: string | null;
  note: string | null;
  sources: ParkingSource[];
};

export type StadiumParking = {
  summary: string | null;
  summarySources: ParkingSource[];
  warnings: { text: string; sources: ParkingSource[] }[];
  spots: ParkingSpot[];
};

function toSources(value: Json | undefined): ParkingSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
    const url = item.url;
    const title = item.title;
    return typeof url === 'string' && url.startsWith('https://')
      ? [{ url, title: typeof title === 'string' && title ? title : url }]
      : [];
  });
}

function toWarnings(value: Json): StadiumParking['warnings'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
    const text = item.text;
    const sources = toSources(item.sources);
    return typeof text === 'string' && sources.length > 0 ? [{ text, sources }] : [];
  });
}

function toKind(value: string): ParkingKind {
  return value === 'parque_oficial' ||
    value === 'parque_publico' ||
    value === 'parque_gratuito' ||
    value === 'rua' ||
    value === 'park_and_ride'
    ? value
    : 'parque_publico';
}

/** What is known about parking at a stadium; `null` when it was never researched. */
export async function fetchStadiumParking(venueId: string): Promise<StadiumParking | null> {
  const [info, spots] = await Promise.all([
    client()
      .from('venue_parking')
      .select('summary, summary_sources, warnings')
      .eq('venue_id', venueId)
      .maybeSingle(),
    client()
      .from('parking_spot')
      .select(
        'id, name, kind, address, operator, latitude, longitude, distance_m, open_on_matchdays, price_note, note, sources'
      )
      .eq('venue_id', venueId)
      .order('distance_m', { nullsFirst: false }),
  ]);
  if (info.error) throw info.error;
  if (spots.error) throw spots.error;
  if (!info.data && spots.data.length === 0) return null;

  return {
    summary: info.data?.summary ?? null,
    summarySources: toSources(info.data?.summary_sources),
    warnings: info.data ? toWarnings(info.data.warnings) : [],
    spots: spots.data.map((row) => ({
      id: row.id,
      name: row.name,
      kind: toKind(row.kind),
      address: row.address,
      operator: row.operator,
      location:
        row.latitude !== null && row.longitude !== null
          ? { latitude: row.latitude, longitude: row.longitude }
          : null,
      distanceM: row.distance_m,
      openOnMatchdays: row.open_on_matchdays,
      priceNote: row.price_note,
      note: row.note,
      sources: toSources(row.sources),
    })),
  };
}
