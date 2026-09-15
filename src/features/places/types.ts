import type { Tables } from '@/lib/database.types';

// Columns read from Supabase. Keep them in sync with the selects in api.ts.

export type PlaceRow = Pick<
  Tables<'place'>,
  | 'id'
  | 'name'
  | 'kind'
  | 'venue_id'
  | 'walking_minutes'
  | 'distance_m'
  | 'latitude'
  | 'longitude'
  | 'opening_hours'
  | 'price_level'
  | 'specialty'
>;

export type DishRow = Pick<
  Tables<'dish'>,
  | 'id'
  | 'place_id'
  | 'name'
  | 'price_cents'
  | 'prep_minutes'
  | 'temperature'
  | 'is_specialty'
  | 'recommendations_count'
>;

/** Fans' averages from place_scores_all: only places rated by at least 5 people. */
export type PlaceScoreRow = {
  place_id: string;
  ratings: number;
  beer_score: number | null;
  food_score: number | null;
};

export type PlaceCatalogRows = {
  places: PlaceRow[];
  dishes: DishRow[];
  scores: PlaceScoreRow[];
};
