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
    row.kind === 'indicacao_oficial' || row.kind === 'zona_a_evitar'
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
