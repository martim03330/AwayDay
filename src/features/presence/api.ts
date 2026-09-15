import { FunctionsHttpError } from '@supabase/supabase-js';

import {
  CheckInRefused,
  type CheckInRecord,
  type ClubPresence,
  type DevicePosition,
  type PlacePulse,
  type RankingRow,
} from '@/features/presence/types';
import { supabase } from '@/lib/supabase';

// Presence on match day. The app never reads check-ins: it sends its own through the `check-in` Edge Function
// and reads the public aggregates (place_pulse) and rankings, which only name people who opted in.

const RANKING_SIZE = 10;

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function toClubs(value: unknown): ClubPresence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    return row && typeof row.club_id === 'string' && typeof row.people === 'number'
      ? [{ clubId: row.club_id, people: row.people }]
      : [];
  });
}

/** Every published aggregate (places with at least 5 people right now). */
export async function fetchPlacePulse(): Promise<PlacePulse[]> {
  const { data, error } = await client()
    .from('place_pulse')
    .select('place_id, venue_id, people, clubs, others, updated_at');
  if (error) throw error;
  return data.map((row) => ({
    placeId: row.place_id,
    venueId: row.venue_id,
    people: row.people,
    clubs: toClubs(row.clubs),
    others: row.others,
    updatedAt: row.updated_at,
  }));
}

/** Turns the function's error answer into CheckInRefused when it is a known refusal. */
async function checkInError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const response: unknown = error.context;
    let body: Readonly<Record<string, unknown>> | null = null;
    if (response instanceof Response) {
      try {
        body = asRecord(await response.json());
      } catch {
        body = null;
      }
    }
    const code = body?.error;
    if (code === 'too_far') {
      return new CheckInRefused(
        'too-far',
        typeof body?.distance_m === 'number' ? body.distance_m : null
      );
    }
    if (code === 'low_accuracy') return new CheckInRefused('low-accuracy');
    if (code === 'place_not_found') return new CheckInRefused('place-not-found');
    if (code === 'rate_limited') return new CheckInRefused('rate-limited');
  }
  return error instanceof Error ? error : new Error('Check-in failed.');
}

/**
 * Checks in at a place. The server measures the distance with this position and forgets it; a refusal throws
 * CheckInRefused.
 */
export async function checkInAtPlace(
  placeId: string,
  position: DevicePosition
): Promise<CheckInRecord> {
  if (position.accuracy === null) throw new CheckInRefused('low-accuracy');
  const { data, error } = await client().functions.invoke<unknown>('check-in', {
    method: 'POST',
    body: {
      action: 'check-in',
      placeId,
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
    },
  });
  if (error) throw await checkInError(error);
  const result = asRecord(data);
  if (
    typeof result?.visit_id !== 'string' ||
    typeof result.visited_at !== 'string' ||
    typeof result.expires_at !== 'string'
  ) {
    throw new Error('Unexpected check-in answer.');
  }
  return { visitId: result.visit_id, visitedAt: result.visited_at, expiresAt: result.expires_at };
}

/** Undoes the active check-in at a place: presence ends and its visit leaves the user's history. */
export async function checkOutOfPlace(placeId: string): Promise<boolean> {
  const { data, error } = await client().functions.invoke<unknown>('check-in', {
    method: 'POST',
    body: { action: 'check-out', placeId },
  });
  if (error) throw await checkInError(error);
  return asRecord(data)?.ended === true;
}

export async function fetchVerifiedPlacesRanking(): Promise<RankingRow[]> {
  const { data, error } = await client().rpc('verified_places_ranking', { p_limit: RANKING_SIZE });
  if (error) throw error;
  return data.map((row) => ({
    position: row.rank_position,
    isMe: row.is_me,
    displayName: row.display_name,
    clubId: row.club_id ?? null,
    value: row.verified_places,
  }));
}

export async function fetchNoiseRanking(fixtureId: string): Promise<RankingRow[]> {
  const { data, error } = await client().rpc('noise_ranking', {
    p_fixture_id: fixtureId,
    p_limit: RANKING_SIZE,
  });
  if (error) throw error;
  return data.map((row) => ({
    position: row.rank_position,
    isMe: row.is_me,
    displayName: row.display_name,
    clubId: row.club_id ?? null,
    value: row.level,
  }));
}
