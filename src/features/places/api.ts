import type { PostgrestError } from '@supabase/supabase-js';

import type { PlaceCatalogRows, PlaceScoreRow } from '@/features/places/types';
import { base64ParaBytes, lerFicheiroEmBase64 } from '@/lib/ficheiros';
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

/** Places (confirmed and suggestions) and their approved dishes. RLS never returns hidden places. */
export async function fetchPlaceCatalogRows(): Promise<PlaceCatalogRows> {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }
  const client = supabase;

  const [places, dishes, scores] = await Promise.all([
    allPages((from, to) =>
      client
        .from('place')
        .select(
          'id, name, kind, venue_id, walking_minutes, distance_m, latitude, longitude, opening_hours, price_level, specialty, confirmation, quick_and_cheap, suitability, votes_yes, votes_no, matchday_note, matchday_sources, home_fans_heavy, toilet_yes, toilet_no, photo_url, photo_author, photo_license, photo_source_url, source, fan_note'
        )
        .order('id')
        .range(from, to)
    ),
    // Someone's own pending suggestions are readable too, but the menu only shows approved dishes.
    allPages((from, to) =>
      client
        .from('dish')
        .select(
          'id, place_id, name, price_cents, prep_minutes, temperature, is_specialty, recommendations_count, currency, source_url, checked_on'
        )
        .eq('status', 'approved')
        .order('id')
        .range(from, to)
    ),
    client.rpc('place_scores_all'),
  ]);

  if (scores.error) throw scores.error;

  // An average is null when nobody gave that kind of score, whatever the generated types say.
  const scoreRows: PlaceScoreRow[] = scores.data.map((row) => ({
    place_id: row.place_id,
    ratings: row.ratings,
    beer_score: typeof row.beer_score === 'number' ? row.beer_score : null,
    food_score: typeof row.food_score === 'number' ? row.food_score : null,
  }));

  return { places, dishes, scores: scoreRows };
}

/** Why the server refused a fan's suggestion. */
export type SuggestionRefusal =
  'duplicate' | 'rate-limited' | 'too-far' | 'bad-name' | 'bad-location' | 'not-signed-in';

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

/**
 * Uploads a photo of a place and records it as pending moderation. The file goes to «anonimas/», never to a folder
 * named after the sender: an approved photo is shown to everyone, and nobody may learn who took it. The server knows
 * the sender from the file's owner.
 */
export async function suggestPlacePhoto(
  placeId: string,
  uri: string,
  mimeType: string
) {
  const bucket = client().storage.from('place-photos');
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/heic' ? 'heic' : 'jpg';
  const path = `anonimas/${placeId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

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

/** How long a signed link to a fan's photo lasts. The query cache refreshes it before then. */
const PHOTO_LINK_SECONDS = 60 * 60;

export type FanPhoto = { id: string; url: string };

/** The most recent approved fan photo of a place, as a temporary link; `null` when there is none. */
export async function fetchApprovedPlacePhoto(placeId: string): Promise<FanPhoto | null> {
  const { data, error } = await client()
    .from('place_photo')
    .select('id, storage_path')
    .eq('place_id', placeId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const signed = await client()
    .storage.from('place-photos')
    .createSignedUrl(data.storage_path, PHOTO_LINK_SECONDS);
  if (signed.error) throw signed.error;
  return { id: data.id, url: signed.data.signedUrl };
}

export type PendingPhoto = {
  id: string;
  placeId: string;
  url: string;
  createdAt: string;
};

/** Photos waiting for approval, oldest first (admins only; others get an empty list). */
export async function fetchPendingPlacePhotos(): Promise<PendingPhoto[]> {
  const { data, error } = await client()
    .from('place_photo')
    .select('id, place_id, storage_path, created_at')
    .eq('status', 'pending')
    .order('created_at')
    .limit(50);
  if (error) throw error;
  if (data.length === 0) return [];
  const signed = await client()
    .storage.from('place-photos')
    .createSignedUrls(
      data.map((row) => row.storage_path),
      PHOTO_LINK_SECONDS
    );
  if (signed.error) throw signed.error;
  const urls = new Map(
    signed.data.flatMap((item) =>
      item.path && item.signedUrl ? [[item.path, item.signedUrl]] : []
    )
  );
  return data.flatMap((row) => {
    const url = urls.get(row.storage_path);
    return url ? [{ id: row.id, placeId: row.place_id, url, createdAt: row.created_at }] : [];
  });
}

export async function moderatePlacePhoto(photoId: string, approve: boolean) {
  const { error } = await client().rpc('moderate_place_photo', {
    p_photo_id: photoId,
    p_approve: approve,
  });
  if (error) throw error;
}

/** How many of the user's photos of tascos were approved (for the photo mission). Asked to the server: the sender
 * column is not readable by clients. */
export async function fetchMyApprovedPhotoCount(): Promise<number> {
  const { data, error } = await client().rpc('my_approved_place_photo_count');
  if (error) throw error;
  return data;
}

export type NewPlace = {
  name: string;
  kind: 'tasca' | 'cervejaria' | 'bar' | 'roulotte' | 'churrasqueira' | 'restaurante' | 'cafe';
  location: { latitude: number; longitude: number };
  /** Why it is worth it, in the fan's own words. */
  note: string;
};

/**
 * Suggests a tasco that is not in the app yet. The server decides everything: which stadium it belongs to, how far
 * it is (up to 45 minutes on foot), whether it is a duplicate and how many suggestions this fan may make. It is born
 * as a suggestion and only becomes a confirmed place when 5 other fans say it is good.
 */
export async function suggestPlace(place: NewPlace): Promise<string> {
  const { data, error } = await client().rpc('suggest_place', {
    p_name: place.name.trim(),
    p_kind: place.kind,
    p_latitude: place.location.latitude,
    p_longitude: place.location.longitude,
    p_note: place.note.trim(),
  });
  if (error) {
    if (error.message === 'duplicate_place') throw new SuggestionRefused('duplicate');
    if (error.message === 'rate_limited') throw new SuggestionRefused('rate-limited');
    if (error.message === 'too_far') throw new SuggestionRefused('too-far');
    if (
      error.message === 'bad_name' ||
      error.message === 'bad_kind' ||
      error.message === 'bad_note'
    )
      throw new SuggestionRefused('bad-name');
    if (error.message === 'bad_location') throw new SuggestionRefused('bad-location');
    if (error.message === 'not_signed_in') throw new SuggestionRefused('not-signed-in');
    throw error;
  }
  return data;
}
