import type { PostgrestError } from '@supabase/supabase-js';

import type { FixtureCatalogRows } from '@/features/fixtures/types';
import { supabase } from '@/lib/supabase';

/** The API returns at most this many rows per request (max_rows). */
const PAGE_SIZE = 1000;

/** Reads every row, page by page: one request alone would stop at 1000 rows and silently drop the rest. */
async function allPages<Row>(
  page: (
    from: number,
    to: number
  ) => PromiseLike<{ data: Row[] | null; error: PostgrestError | null }>
) {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) return rows;
  }
}

/**
 * The first day of the previous season (1 July, UTC). Meeting points and weather older than this are not downloaded:
 * they only matter around a game.
 */
export function previousSeasonStart(now: Date) {
  const seasonStartYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(seasonStartYear - 1, 6, 1)).toISOString();
}

/** The value of a settled read, or `fallback` when it failed. */
function valueOr<T>(result: PromiseSettledResult<T>, fallback: T) {
  return result.status === 'fulfilled' ? result.value : fallback;
}

/** The value of a settled read the catalogue cannot do without: throws its error when it failed. */
function valueOrThrow<T>(result: PromiseSettledResult<T>) {
  if (result.status === 'rejected') throw result.reason;
  return result.value;
}

/**
 * Reads the catalogue in parallel: competitions, venues, clubs and every fixture (paged),
 * plus the meeting points and weather of recent fixtures. The first four are essential and any failure throws; meeting
 * points and weather are extras, so a failure there leaves them empty and the rest still arrives.
 */
export async function fetchFixtureCatalogRows(now: Date = new Date()): Promise<FixtureCatalogRows> {
  if (!supabase) {
    throw new Error('Supabase is not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }
  const client = supabase;
  const since = previousSeasonStart(now);

  const [competitions, venues, clubs, fixtures, meetingPoints, weather] = await Promise.allSettled([
    allPages((from, to) =>
      client.from('competition').select('id, name, kind, tier').order('id').range(from, to)
    ),
    allPages((from, to) =>
      client
        .from('venue')
        .select(
          'id, name, city, country, region, capacity, latitude, longitude, roof_coverage, address, photo_url, photo_author, photo_license, photo_source_url'
        )
        .order('id')
        .range(from, to)
    ),
    allPages((from, to) =>
      client
        .from('club')
        .select(
          'id, name, short_name, abbreviation, country, primary_color, secondary_color, tier, home_venue_id'
        )
        .order('id')
        .range(from, to)
    ),
    allPages((from, to) =>
      client
        .from('fixture')
        .select('id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at, kickoff_confirmed')
        // Every fixture, old ones too: the passport, the history and the album look up games already played by id.
        // Paging keeps them all past the API's 1000-row cap.
        .order('kickoff_at')
        // Ties in kick-off time need a fixed order, or a row could fall between two pages.
        .order('id')
        .range(from, to)
    ),
    // Only for fixtures from the start of the previous season: the join keeps the rows whose fixture is recent.
    allPages((from, to) =>
      client
        .from('fixture_meeting_point')
        .select(
          'fixture_id, name, address, schedule, transport, note, origin, published_by, source_title, source_url, published_on, latitude, longitude, fixture!inner(kickoff_at)'
        )
        .gte('fixture.kickoff_at', since)
        .order('fixture_id')
        .range(from, to)
    ),
    allPages((from, to) =>
      client
        .from('fixture_weather')
        .select(
          'fixture_id, source, condition, temperature_c, rain_probability, wind_kmh, warning_level, warning_kind, fixture!inner(kickoff_at)'
        )
        .gte('fixture.kickoff_at', since)
        .order('fixture_id')
        .range(from, to)
    ),
  ]);

  return {
    competitions: valueOrThrow(competitions),
    venues: valueOrThrow(venues),
    clubs: valueOrThrow(clubs),
    fixtures: valueOrThrow(fixtures),
    // The joined fixture only filtered the rows; it is not part of the catalogue.
    meetingPoints: valueOr(meetingPoints, []).map(({ fixture: _fixture, ...row }) => row),
    weather: valueOr(weather, []).map(({ fixture: _fixture, ...row }) => row),
  };
}
