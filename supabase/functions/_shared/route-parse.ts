// Reading routes for the `rides` Edge Function: the Valhalla answer and the rows cached in route_cache. Pure (no
// Deno or network APIs) so the app's tests can load it. Anything malformed comes out as `null`, never as a route
// with made-up numbers: a ride price is real money for real people.

import type { TollSegment } from './ride-cost.ts';

export type Route = { distanceM: number; durationS: number; tollM: number; tollSegments: TollSegment[] };

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

const MOTORWAY = /^A\s*(\d+(?:-\d+)?)$/i;

/**
 * The motorway of a stretch of road, as the toll rates name it ("A1"), from Valhalla's `street_names`: "A 1", "A1",
 * ["Autoestrada do Norte", "A 1"] or "A 1/IP 1" all give "A1". Anything that is not a motorway reference counts
 * under the "default" rate.
 */
export function motorwayOf(names: unknown): string {
  const list: unknown[] = Array.isArray(names) ? names : [names];
  for (const name of list) {
    if (typeof name !== 'string') continue;
    // OpenStreetMap joins several references of one road with ";" and Valhalla sometimes with "/".
    for (const part of name.split(/[/;]/)) {
      const match = MOTORWAY.exec(part.trim());
      if (match) return `A${match[1]}`;
    }
  }
  return 'default';
}

/** Tolled stretches of a Valhalla trip, in metres, one per maneuver on a toll road. */
export function tollSegmentsOf(trip: unknown): TollSegment[] {
  const segments: TollSegment[] = [];
  const legs = asRecord(trip)?.legs;
  for (const legValue of Array.isArray(legs) ? legs : []) {
    const maneuvers = asRecord(legValue)?.maneuvers;
    for (const maneuverValue of Array.isArray(maneuvers) ? maneuvers : []) {
      const maneuver = asRecord(maneuverValue);
      const lengthKm = maneuver?.length;
      if (maneuver?.toll !== true || typeof lengthKm !== 'number') continue;
      if (!Number.isFinite(lengthKm) || lengthKm < 0) continue;
      segments.push({ motorway: motorwayOf(maneuver.street_names), tollM: Math.round(lengthKm * 1000) });
    }
  }
  return segments;
}

function sumTollM(segments: readonly TollSegment[]) {
  return segments.reduce((total, segment) => total + segment.tollM, 0);
}

/** A route from Valhalla's JSON answer (kilometres and seconds), or `null` when it has no usable summary. */
export function routeFromValhalla(answer: unknown): Route | null {
  return routeFromTrip(asRecord(answer)?.trip);
}

/**
 * Every route of a Valhalla answer asked with `alternates`: the main trip first, then each alternative that can be
 * read. Empty when not even the main trip can.
 */
export function routesFromValhalla(answer: unknown): Route[] {
  const record = asRecord(answer);
  const main = routeFromTrip(record?.trip);
  if (!main) return [];
  const alternates = Array.isArray(record?.alternates) ? record.alternates : [];
  const others = alternates.flatMap((alternate) => {
    const found = routeFromTrip(asRecord(alternate)?.trip);
    return found ? [found] : [];
  });
  return [main, ...others];
}

function routeFromTrip(tripValue: unknown): Route | null {
  const trip = asRecord(tripValue);
  const summary = asRecord(trip?.summary);
  const lengthKm = summary?.length;
  const timeS = summary?.time;
  if (typeof lengthKm !== 'number' || typeof timeS !== 'number') return null;
  if (!Number.isFinite(lengthKm) || !Number.isFinite(timeS) || lengthKm < 0 || timeS < 0) return null;
  const tollSegments = tollSegmentsOf(trip);
  return {
    // A route of zero metres (origin on top of the stadium) still counts as 1 m: costs never divide by nothing.
    distanceM: Math.max(Math.round(lengthKm * 1000), 1),
    durationS: Math.max(Math.round(timeS), 1),
    tollM: sumTollM(tollSegments),
    tollSegments,
  };
}

function positiveWhole(value: unknown): number | null {
  // Postgres bigint columns may come back as strings; anything else that is not a whole number is refused.
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof number === 'number' && Number.isSafeInteger(number) && number >= 1 ? number : null;
}

/**
 * A route_cache row (`distance_m`, `duration_s`, `toll_segments`), or `null` when anything in it is malformed —
 * the caller then asks the router again and overwrites the bad row.
 */
export function routeFromCache(row: unknown): Route | null {
  const record = asRecord(row);
  const distanceM = positiveWhole(record?.distance_m);
  const durationS = positiveWhole(record?.duration_s);
  const rawSegments = record?.toll_segments;
  if (distanceM === null || durationS === null || !Array.isArray(rawSegments)) return null;
  const tollSegments: TollSegment[] = [];
  for (const value of rawSegments) {
    const segment = asRecord(value);
    const motorway = segment?.motorway;
    const tollM = segment?.tollM;
    if (typeof motorway !== 'string' || motorway.length === 0) return null;
    if (typeof tollM !== 'number' || !Number.isSafeInteger(tollM) || tollM < 0) return null;
    tollSegments.push({ motorway, tollM });
  }
  const tollM = sumTollM(tollSegments);
  if (!Number.isSafeInteger(tollM)) return null;
  return { distanceM, durationS, tollM, tollSegments };
}
