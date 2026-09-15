import type { PlaceCatalogRows, PlaceScoreRow } from '@/features/places/types';
import { supabase } from '@/lib/supabase';

/** Places (confirmed and suggestions) and their approved dishes. RLS never returns hidden places. */
export async function fetchPlaceCatalogRows(): Promise<PlaceCatalogRows> {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }

  const [places, dishes, scores] = await Promise.all([
    supabase
      .from('place')
      .select(
        'id, name, kind, venue_id, walking_minutes, distance_m, latitude, longitude, opening_hours, price_level, specialty, confirmation, quick_and_cheap, suitability, votes_yes, votes_no'
      ),
    // Someone's own pending suggestions are readable too, but the menu only shows approved dishes.
    supabase
      .from('dish')
      .select(
        'id, place_id, name, price_cents, prep_minutes, temperature, is_specialty, recommendations_count'
      )
      .eq('status', 'approved'),
    supabase.rpc('place_scores_all'),
  ]);

  if (places.error) throw places.error;
  if (dishes.error) throw dishes.error;
  if (scores.error) throw scores.error;

  // An average is null when nobody gave that kind of score, whatever the generated types say.
  const scoreRows: PlaceScoreRow[] = scores.data.map((row) => ({
    place_id: row.place_id,
    ratings: row.ratings,
    beer_score: typeof row.beer_score === 'number' ? row.beer_score : null,
    food_score: typeof row.food_score === 'number' ? row.food_score : null,
  }));

  return { places: places.data, dishes: dishes.data, scores: scoreRows };
}
