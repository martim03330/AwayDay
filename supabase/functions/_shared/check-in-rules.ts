// The rules of a check-in at a tasco, for the `check-in` Edge Function: reading the request and checking the phone
// is really there. Pure (no Deno or network APIs) so the app's tests can load it.
// The position is only used to measure the distance, then dropped: nothing returned from here carries it.

/** How far from the place a check-in still counts. */
export const MAX_DISTANCE_M = 150;
/** Positions less precise than this are refused: they could put someone in the tasco next door. */
export const MAX_ACCURACY_M = 100;
const PLACE_ID = /^[a-z0-9-]{1,120}$/;
const EARTH_RADIUS_M = 6_371_000;

export type CheckInBody =
  | { action: 'check-in'; placeId: string; latitude: number; longitude: number; accuracy: number }
  | { action: 'check-out'; placeId: string };

export type PresenceCheck =
  | { ok: true }
  | { ok: false; error: 'low_accuracy' }
  /** `distance_m` is rounded to 50 m: enough to say "you are 400 m away", not a precise position. */
  | { ok: false; error: 'too_far'; distance_m: number };

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function finiteBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/** The request body, or `null` (answer 400). A check-out needs no position. */
export function parseCheckInBody(value: unknown): CheckInBody | null {
  const body = asRecord(value);
  if (!body || typeof body.placeId !== 'string' || !PLACE_ID.test(body.placeId)) return null;
  if (body.action === 'check-out') return { action: 'check-out', placeId: body.placeId };
  if (
    body.action !== 'check-in' ||
    !finiteBetween(body.latitude, -90, 90) ||
    !finiteBetween(body.longitude, -180, 180) ||
    !finiteBetween(body.accuracy, 0, 100_000)
  ) {
    return null;
  }
  return {
    action: 'check-in',
    placeId: body.placeId,
    latitude: body.latitude,
    longitude: body.longitude,
    accuracy: body.accuracy,
  };
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

/** Straight-line distance in metres (haversine). */
export function distanceM(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Whether a phone at `position` counts as being at the place. The answer never includes the position. */
export function checkPresence(
  position: { latitude: number; longitude: number; accuracy: number },
  place: { latitude: number; longitude: number }
): PresenceCheck {
  if (position.accuracy > MAX_ACCURACY_M) return { ok: false, error: 'low_accuracy' };
  const distance = distanceM(
    { lat: position.latitude, lng: position.longitude },
    { lat: place.latitude, lng: place.longitude }
  );
  if (distance > MAX_DISTANCE_M) {
    return { ok: false, error: 'too_far', distance_m: Math.round(distance / 50) * 50 };
  }
  return { ok: true };
}
