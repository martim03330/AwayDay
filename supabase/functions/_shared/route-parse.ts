// Reading routes for the `rides` Edge Function: the Valhalla answer and the rows cached in route_cache. Pure (no
// Deno or network APIs) so the app's tests can load it. Anything malformed comes out as `null`, never as a route
// with made-up numbers: a ride price is real money for real people.

import type { TollSegment } from './ride-cost.ts';

export type Route = {
  distanceM: number;
  durationS: number;
  tollM: number;
  tollSegments: TollSegment[];
  /** Every motorway taken, in driving order, free ones included, each once (bits under 1 km left out). */
  motorways: string[];
  /** Points a quarter, half and three quarters of the way along, for opening this road in Maps. */
  viaPoints: LatLng[];
};

export type LatLng = { latitude: number; longitude: number };

/** Valhalla's encoded line (Google's polyline algorithm, 6 decimal places). Stops at the first malformed character. */
export function decodePolyline6(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    for (;;) {
      if (index >= encoded.length) return null;
      const byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) return null;
      result |= (byte & 0x1f) << shift;
      shift += 5;
      if (byte < 0x20) break;
      if (shift > 30) return null;
    }
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    const dLat = next();
    const dLng = next();
    if (dLat === null || dLng === null) break;
    lat += dLat;
    lng += dLng;
    points.push({ latitude: lat / 1e6, longitude: lng / 1e6 });
  }
  return points;
}

function metresBetween(a: LatLng, b: LatLng) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The points at these fractions of a line's length (0.5 = half way), to 5 decimal places (~1 m). Empty for a line
 * too short to have a middle.
 */
export function pointsAlong(line: readonly LatLng[], fractions: readonly number[]): LatLng[] {
  if (line.length < 2) return [];
  const cumulative = [0];
  for (let i = 1; i < line.length; i += 1) cumulative.push(cumulative[i - 1] + metresBetween(line[i - 1], line[i]));
  const total = cumulative[cumulative.length - 1];
  if (!(total > 0)) return [];
  const round = (value: number) => Math.round(value * 1e5) / 1e5;
  return fractions.map((fraction) => {
    const target = total * Math.min(1, Math.max(0, fraction));
    let i = 1;
    while (i < cumulative.length - 1 && cumulative[i] < target) i += 1;
    const span = cumulative[i] - cumulative[i - 1];
    const t = span > 0 ? (target - cumulative[i - 1]) / span : 0;
    return {
      latitude: round(line[i - 1].latitude + (line[i].latitude - line[i - 1].latitude) * t),
      longitude: round(line[i - 1].longitude + (line[i].longitude - line[i - 1].longitude) * t),
    };
  });
}

const VIA_FRACTIONS = [0.25, 0.5, 0.75] as const;

/** The waypoints of a Valhalla trip: its legs' lines joined, then the points at a quarter, half and three quarters. */
export function viaPointsOfTrip(trip: unknown): LatLng[] {
  const legs = asRecord(trip)?.legs;
  const line: LatLng[] = [];
  for (const legValue of Array.isArray(legs) ? legs : []) {
    const shape = asRecord(legValue)?.shape;
    if (typeof shape === 'string') line.push(...decodePolyline6(shape));
  }
  return pointsAlong(line, VIA_FRACTIONS);
}

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

/** The motorways of a Valhalla trip in driving order, tolled or not, each once when it adds up to 1 km or more. */
export function motorwaysOfTrip(trip: unknown): string[] {
  const metres = new Map<string, number>();
  const legs = asRecord(trip)?.legs;
  for (const legValue of Array.isArray(legs) ? legs : []) {
    const maneuvers = asRecord(legValue)?.maneuvers;
    for (const maneuverValue of Array.isArray(maneuvers) ? maneuvers : []) {
      const maneuver = asRecord(maneuverValue);
      const lengthKm = maneuver?.length;
      if (typeof lengthKm !== 'number' || !Number.isFinite(lengthKm) || lengthKm < 0) continue;
      const motorway = motorwayOf(maneuver?.street_names);
      if (motorway === 'default') continue;
      metres.set(motorway, (metres.get(motorway) ?? 0) + lengthKm * 1000);
    }
  }
  return [...metres].filter(([, total]) => total >= 1000).map(([motorway]) => motorway);
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
    motorways: motorwaysOfTrip(trip),
    viaPoints: viaPointsOfTrip(trip),
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
  // Rows cached before this column existed have none: the route is still good, just unnamed.
  const rawMotorways = record?.motorways;
  const motorways = Array.isArray(rawMotorways)
    ? rawMotorways.filter((name): name is string => typeof name === 'string' && name.length > 0)
    : [];
  const rawVia = record?.via_points;
  const viaPoints = Array.isArray(rawVia)
    ? rawVia.flatMap((value) => {
        const point = asRecord(value);
        const latitude = point?.latitude;
        const longitude = point?.longitude;
        return typeof latitude === 'number' &&
          typeof longitude === 'number' &&
          Math.abs(latitude) <= 90 &&
          Math.abs(longitude) <= 180
          ? [{ latitude, longitude }]
          : [];
      })
    : [];
  return { distanceM, durationS, tollM, tollSegments, motorways, viaPoints };
}
