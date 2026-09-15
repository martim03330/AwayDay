import type { PlaceCatalogRows, PlaceScoreRow } from '@/features/places/types';
import { base64ParaBytes, lerFicheiroEmBase64 } from '@/lib/ficheiros';
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

/** Why the server refused a fan's suggestion. */
export type SuggestionRefusal = 'duplicate' | 'rate-limited';

export class SuggestionRefused extends Error {
  readonly reason: SuggestionRefusal;

  constructor(reason: SuggestionRefusal) {
    super(reason);
    this.name = 'SuggestionRefused';
    this.reason = reason;
  }
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type DishSuggestion = {
  placeId: string;
  name: string;
  /** Integer cents, or `null` when the fan does not know the price. */
  priceCents: number | null;
  prepMinutes: number | null;
  temperature: 'hot' | 'cold' | null;
};

/** Suggests a dish for a place. It stays pending (invisible to others) until the owner approves it. */
export async function suggestDish(suggestion: DishSuggestion) {
  const { error } = await client().from('dish').insert({
    place_id: suggestion.placeId,
    name: suggestion.name.trim(),
    price_cents: suggestion.priceCents,
    prep_minutes: suggestion.prepMinutes,
    temperature: suggestion.temperature,
  });
  if (!error) return;
  if (error.code === '23505') throw new SuggestionRefused('duplicate');
  if (error.message === 'dish_suggestion_rate_limited') throw new SuggestionRefused('rate-limited');
  throw error;
}

/** Uploads a photo of a place to the uploader's folder and records it as pending moderation. */
export async function suggestPlacePhoto(
  userId: string,
  placeId: string,
  uri: string,
  mimeType: string
) {
  const bucket = client().storage.from('place-photos');
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/heic' ? 'heic' : 'jpg';
  const path = `${userId}/${placeId}-${Date.now()}.${extension}`;

  const upload = await bucket.upload(path, base64ParaBytes(await lerFicheiroEmBase64(uri)), {
    contentType: mimeType,
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const { error } = await client()
    .from('place_photo')
    .insert({ place_id: placeId, storage_path: path });
  if (!error) return;
  // Do not leave an orphan file behind.
  await bucket.remove([path]);
  if (error.message === 'place_photo_rate_limited') throw new SuggestionRefused('rate-limited');
  throw error;
}
