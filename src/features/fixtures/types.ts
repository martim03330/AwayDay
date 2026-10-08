import type { Tables } from '@/lib/database.types';

// Columns read from Supabase. Keep them in sync with the selects in api.ts.

export type CompetitionRow = Pick<Tables<'competition'>, 'id' | 'name' | 'kind' | 'tier'>;

export type VenueRow = Pick<
  Tables<'venue'>,
  | 'id'
  | 'name'
  | 'city'
  | 'country'
  | 'region'
  | 'capacity'
  | 'latitude'
  | 'longitude'
  | 'roof_coverage'
  | 'address'
> &
  // Optional so the bundled catalogue need not carry them.
  Partial<Pick<Tables<'venue'>, 'photo_url' | 'photo_author' | 'photo_license' | 'photo_source_url'>>;

export type ClubRow = Pick<
  Tables<'club'>,
  | 'id'
  | 'name'
  | 'short_name'
  | 'abbreviation'
  | 'country'
  | 'primary_color'
  | 'secondary_color'
  | 'tier'
  | 'home_venue_id'
>;

export type FixtureRow = Pick<
  Tables<'fixture'>,
  'id' | 'competition_id' | 'stage' | 'home_club_id' | 'away_club_id' | 'venue_id' | 'kickoff_at'
> &
  // Optional so the bundled sample fixtures need not carry it (they all have a set time).
  Partial<Pick<Tables<'fixture'>, 'kickoff_confirmed'>>;

export type MeetingPointRow = Pick<
  Tables<'fixture_meeting_point'>,
  | 'fixture_id'
  | 'name'
  | 'address'
  | 'schedule'
  | 'transport'
  | 'note'
  | 'origin'
  | 'published_by'
  | 'source_title'
  | 'source_url'
  | 'published_on'
  | 'latitude'
  | 'longitude'
>;

export type WeatherRow = Pick<
  Tables<'fixture_weather'>,
  | 'fixture_id'
  | 'source'
  | 'condition'
  | 'temperature_c'
  | 'rain_probability'
  | 'wind_kmh'
  | 'warning_level'
  | 'warning_kind'
>;

export type FixtureCatalogRows = {
  competitions: CompetitionRow[];
  venues: VenueRow[];
  clubs: ClubRow[];
  fixtures: FixtureRow[];
  /** Official meeting points for travelling fans. The bundled catalogue has none. */
  meetingPoints?: MeetingPointRow[];
  /** Forecast at kick-off for the coming games (from sync-weather). The bundled catalogue has none. */
  weather?: WeatherRow[];
};
