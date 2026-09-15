import type { FixtureCatalogRows } from '@/features/fixtures/types';
import { supabase } from '@/lib/supabase';

/** Reads the whole catalogue (competitions, venues, clubs and fixtures) in four parallel requests. */
export async function fetchFixtureCatalogRows(): Promise<FixtureCatalogRows> {
  if (!supabase) {
    throw new Error('Supabase is not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }

  const [competitions, venues, clubs, fixtures, meetingPoints] = await Promise.all([
    supabase.from('competition').select('id, name, kind, tier'),
    supabase
      .from('venue')
      .select('id, name, city, country, region, capacity, latitude, longitude, roof_coverage, address'),
    supabase
      .from('club')
      .select(
        'id, name, short_name, abbreviation, country, primary_color, secondary_color, tier, home_venue_id'
      ),
    supabase
      .from('fixture')
      .select('id, competition_id, stage, home_club_id, away_club_id, venue_id, kickoff_at, kickoff_confirmed')
      .order('kickoff_at'),
    supabase
      .from('fixture_meeting_point')
      .select(
        'fixture_id, name, address, schedule, transport, note, origin, published_by, source_title, source_url, published_on'
      ),
  ]);

  if (competitions.error) throw competitions.error;
  if (venues.error) throw venues.error;
  if (clubs.error) throw clubs.error;
  if (fixtures.error) throw fixtures.error;
  if (meetingPoints.error) throw meetingPoints.error;

  return {
    competitions: competitions.data,
    venues: venues.data,
    clubs: clubs.data,
    fixtures: fixtures.data,
    meetingPoints: meetingPoints.data,
  };
}
