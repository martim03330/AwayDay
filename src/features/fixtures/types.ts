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
>;

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
>;

export type FixtureCatalogRows = {
  competitions: CompetitionRow[];
  venues: VenueRow[];
  clubs: ClubRow[];
  fixtures: FixtureRow[];
};
