import type { SafetyNote } from '@/features/safety/types';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function toSources(value: unknown): SafetyNote['sources'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = asRecord(item);
    return source && typeof source.title === 'string' && typeof source.url === 'string'
      ? [
          {
            title: source.title,
            url: source.url,
            date: typeof source.date === 'string' ? source.date : null,
          },
        ]
      : [];
  });
}

/** Safety notes for visiting fans at one stadium. Public reference data. */
export async function fetchSafetyNotes(venueId: string): Promise<SafetyNote[]> {
  const { data, error } = await client()
    .from('venue_safety_note')
    .select(
      'id, venue_id, visiting_club_id, kind, title, description, latitude, longitude, radius_m, reference_date, sources'
    )
    .eq('venue_id', venueId)
    .order('kind')
    .order('reference_date', { ascending: false });
  if (error) throw error;
  return data.flatMap((row) =>
    row.kind === 'indicacao_oficial' ||
    row.kind === 'zona_a_evitar' ||
    row.kind === 'zona_adeptos_casa' ||
    row.kind === 'percurso_visitantes'
      ? [
          {
            id: row.id,
            venueId: row.venue_id,
            visitingClubId: row.visiting_club_id,
            kind: row.kind,
            title: row.title,
            description: row.description,
            point:
              row.latitude !== null && row.longitude !== null
                ? { latitude: row.latitude, longitude: row.longitude }
                : null,
            radiusM: row.radius_m,
            referenceDate: row.reference_date,
            sources: toSources(row.sources),
          },
        ]
      : []
  );
}

/** A ~150 m cell that at least 3 fans flagged as having many home fans, around this game's kick-off. */
export type HomeFanZone = { latitude: number; longitude: number; reporters: number };

export async function fetchHomeFanZones(fixtureId: string): Promise<HomeFanZone[]> {
  const { data, error } = await client().rpc('home_fan_zones', { p_fixture_id: fixtureId });
  if (error) throw error;
  return data.map((row) => ({
    latitude: row.latitude,
    longitude: row.longitude,
    reporters: row.reporters,
  }));
}

export type HomeFanReportRefusal = 'too_far' | 'rate_limited' | 'outside_window' | 'unknown';

export class HomeFanReportRefused extends Error {
  readonly reason: HomeFanReportRefusal;

  constructor(reason: HomeFanReportRefusal) {
    super(reason);
    this.name = 'HomeFanReportRefused';
    this.reason = reason;
  }
}

/** Flags "many home fans here" around the fan's position; the server keeps only the ~150 m cell. */
export async function reportHomeFans(
  fixtureId: string,
  position: { latitude: number; longitude: number }
) {
  const { error } = await client().rpc('report_home_fans', {
    p_fixture_id: fixtureId,
    p_latitude: position.latitude,
    p_longitude: position.longitude,
  });
  if (!error) return;
  const reason =
    error.message === 'too_far' ||
    error.message === 'rate_limited' ||
    error.message === 'outside_window'
      ? error.message
      : 'unknown';
  throw new HomeFanReportRefused(reason);
}

export type HomeFanStreet = {
  name: string;
  /** In how many games fans flagged this street. */
  fixtures: number;
  path: { latitude: number; longitude: number }[];
};

/**
 * The streets where home fans usually are at a stadium: what fans flagged, game after game, snapped to the street it
 * happened on. The server only publishes a street from 5 different people and 2 different games up — below that it
 * could point at one person's evening, and never at a person.
 */
export async function fetchHomeFanStreets(venueId: string): Promise<HomeFanStreet[]> {
  const { data, error } = await client().rpc('home_fan_usual_streets', { p_venue_id: venueId });
  if (error) throw error;
  return data.flatMap((row) => {
    const shape = asRecord(row.path);
    const coordinates = shape?.type === 'LineString' ? shape.coordinates : null;
    if (!Array.isArray(coordinates)) return [];
    const path = coordinates.flatMap((point) =>
      Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number'
        ? [{ latitude: point[1], longitude: point[0] }]
        : []
    );
    return path.length >= 2 ? [{ name: row.name, fixtures: row.fixtures, path }] : [];
  });
}
