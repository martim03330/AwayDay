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

/**
 * One road edge of a leg, from Valhalla's `/trace_attributes` (`edge.names`, `edge.length`, `edge.toll`,
 * `edge.begin_shape_index`). A long maneuver keeps only the name of the street it starts on: Lisboa → Porto is one
 * 288 km «keep left onto 2ª Circular» that is A1 almost all the way. The edges carry each road's real name.
 */
export type RouteEdge = { beginShapeIndex: number; lengthM: number; toll: boolean; motorway: string };

/** The edges of a `/trace_attributes` answer, in driving order. Malformed edges are left out. */
export function edgesFromTraceAttributes(answer: unknown): RouteEdge[] {
  const edges = asRecord(answer)?.edges;
  return (Array.isArray(edges) ? edges : []).flatMap((value) => {
    const edge = asRecord(value);
    const begin = edge?.begin_shape_index;
    const lengthKm = edge?.length;
    if (typeof begin !== 'number' || !Number.isSafeInteger(begin) || begin < 0) return [];
    if (typeof lengthKm !== 'number' || !Number.isFinite(lengthKm) || lengthKm < 0) return [];
    const motorway = motorwayOf(edge?.names);
    return [{ beginShapeIndex: begin, lengthM: lengthKm * 1000, toll: edge?.toll === true, motorway }];
  });
}

/** Metres on each motorway among the edges inside a maneuver's stretch of line, in driving order. */
function motorwayMetresInside(
  edges: readonly RouteEdge[],
  begin: number,
  end: number,
  onlyTolled: boolean
): Map<string, number> {
  const metres = new Map<string, number>();
  for (const edge of edges) {
    if (edge.beginShapeIndex < begin || edge.beginShapeIndex >= end) continue;
    if (edge.motorway === 'default' || (onlyTolled && !edge.toll)) continue;
    metres.set(edge.motorway, (metres.get(edge.motorway) ?? 0) + edge.lengthM);
  }
  return metres;
}

/** The motorway with the most metres, or "default" when there is none. */
function longestOf(metres: ReadonlyMap<string, number>): string {
  let best = 'default';
  let bestM = 0;
  for (const [motorway, total] of metres) {
    if (total > bestM) {
      best = motorway;
      bestM = total;
    }
  }
  return best;
}

/** A maneuver's stretch of the leg's line, as shape indices, or `null` when Valhalla did not give it. */
function shapeRangeOf(maneuver: Readonly<Record<string, unknown>>): [number, number] | null {
  const begin = maneuver.begin_shape_index;
  const end = maneuver.end_shape_index;
  return typeof begin === 'number' && typeof end === 'number' && end > begin ? [begin, end] : null;
}

/**
 * The maneuvers of each leg of a trip, with the edges of that leg (empty when there are none). `edgesByLeg[i]` goes
 * with leg `i`.
 */
function legsOf(trip: unknown, edgesByLeg: readonly (readonly RouteEdge[])[]) {
  const legs = asRecord(trip)?.legs;
  return (Array.isArray(legs) ? legs : []).map((legValue, index) => {
    const maneuvers = asRecord(legValue)?.maneuvers;
    return {
      maneuvers: (Array.isArray(maneuvers) ? maneuvers : []).flatMap((value) => {
        const maneuver = asRecord(value);
        return maneuver ? [maneuver] : [];
      }),
      edges: edgesByLeg[index] ?? [],
    };
  });
}

/**
 * Whether a trip has a stretch of 1 km or more on a fast or tolled road that its maneuvers do not name as a
 * motorway: only then is it worth asking Valhalla for the edges.
 */
export function tripNeedsEdges(trip: unknown): boolean {
  return legsOf(trip, []).some(({ maneuvers }) =>
    maneuvers.some((maneuver) => {
      const lengthKm = maneuver.length;
      return (
        (maneuver.highway === true || maneuver.toll === true) &&
        typeof lengthKm === 'number' &&
        lengthKm >= 1 &&
        motorwayOf(maneuver.street_names) === 'default'
      );
    })
  );
}

/** The encoded line of each leg of a trip, to ask `/trace_attributes` for its edges. */
export function legShapesOf(trip: unknown): string[] {
  const legs = asRecord(trip)?.legs;
  return (Array.isArray(legs) ? legs : []).map((leg) => {
    const shape = asRecord(leg)?.shape;
    return typeof shape === 'string' ? shape : '';
  });
}

/**
 * Tolled stretches of a Valhalla trip, in metres, one per maneuver on a toll road. The metres are always the
 * maneuver's (the rates are measured in them); the edges, when given, only name a maneuver its street names do not:
 * the tolled motorway with the most metres inside it.
 */
export function tollSegmentsOf(trip: unknown, edgesByLeg: readonly (readonly RouteEdge[])[] = []): TollSegment[] {
  const segments: TollSegment[] = [];
  for (const { maneuvers, edges } of legsOf(trip, edgesByLeg)) {
    for (const maneuver of maneuvers) {
      const lengthKm = maneuver.length;
      if (maneuver.toll !== true || typeof lengthKm !== 'number') continue;
      if (!Number.isFinite(lengthKm) || lengthKm < 0) continue;
      let motorway = motorwayOf(maneuver.street_names);
      const range = shapeRangeOf(maneuver);
      if (motorway === 'default' && range) {
        motorway = longestOf(motorwayMetresInside(edges, range[0], range[1], true));
      }
      segments.push({ motorway, tollM: Math.round(lengthKm * 1000) });
    }
  }
  return segments;
}

/**
 * The motorways of a Valhalla trip in driving order, tolled or not, each once when it adds up to 1 km or more. A
 * maneuver its street names do not name counts the motorways of its edges, when given.
 */
export function motorwaysOfTrip(trip: unknown, edgesByLeg: readonly (readonly RouteEdge[])[] = []): string[] {
  const metres = new Map<string, number>();
  const add = (motorway: string, total: number) => metres.set(motorway, (metres.get(motorway) ?? 0) + total);
  for (const { maneuvers, edges } of legsOf(trip, edgesByLeg)) {
    for (const maneuver of maneuvers) {
      const lengthKm = maneuver.length;
      if (typeof lengthKm !== 'number' || !Number.isFinite(lengthKm) || lengthKm < 0) continue;
      const motorway = motorwayOf(maneuver.street_names);
      if (motorway !== 'default') {
        add(motorway, lengthKm * 1000);
        continue;
      }
      const range = shapeRangeOf(maneuver);
      if (!range) continue;
      for (const [inside, total] of motorwayMetresInside(edges, range[0], range[1], false)) add(inside, total);
    }
  }
  return [...metres].filter(([, total]) => total >= 1000).map(([motorway]) => motorway);
}

function sumTollM(segments: readonly TollSegment[]) {
  return segments.reduce((total, segment) => total + segment.tollM, 0);
}

/** A route from Valhalla's JSON answer (kilometres and seconds), or `null` when it has no usable summary. */
export function routeFromValhalla(
  answer: unknown,
  edgesByLeg: readonly (readonly RouteEdge[])[] = []
): Route | null {
  return routeFromTrip(asRecord(answer)?.trip, edgesByLeg);
}

/** The trips of a Valhalla answer asked with `alternates`: the main one first, then each alternative, as given. */
export function tripsOfValhalla(answer: unknown): unknown[] {
  const record = asRecord(answer);
  const alternates = Array.isArray(record?.alternates) ? record.alternates : [];
  return [record?.trip, ...alternates.map((alternate) => asRecord(alternate)?.trip)];
}

/**
 * Every route of a Valhalla answer asked with `alternates`: the main trip first, then each alternative that can be
 * read. Empty when not even the main trip can. `edgesByTrip[i]` are the edges of trip `i` of `tripsOfValhalla`, per
 * leg, for the trips that needed them.
 */
export function routesFromValhalla(
  answer: unknown,
  edgesByTrip: readonly (readonly (readonly RouteEdge[])[])[] = []
): Route[] {
  const trips = tripsOfValhalla(answer);
  const main = routeFromTrip(trips[0], edgesByTrip[0] ?? []);
  if (!main) return [];
  const others = trips.slice(1).flatMap((trip, index) => {
    const found = routeFromTrip(trip, edgesByTrip[index + 1] ?? []);
    return found ? [found] : [];
  });
  return [main, ...others];
}

function routeFromTrip(tripValue: unknown, edgesByLeg: readonly (readonly RouteEdge[])[]): Route | null {
  const trip = asRecord(tripValue);
  const summary = asRecord(trip?.summary);
  const lengthKm = summary?.length;
  const timeS = summary?.time;
  if (typeof lengthKm !== 'number' || typeof timeS !== 'number') return null;
  if (!Number.isFinite(lengthKm) || !Number.isFinite(timeS) || lengthKm < 0 || timeS < 0) return null;
  const tollSegments = tollSegmentsOf(trip, edgesByLeg);
  return {
    // A route of zero metres (origin on top of the stadium) still counts as 1 m: costs never divide by nothing.
    distanceM: Math.max(Math.round(lengthKm * 1000), 1),
    durationS: Math.max(Math.round(timeS), 1),
    tollM: sumTollM(tollSegments),
    tollSegments,
    motorways: motorwaysOfTrip(trip, edgesByLeg),
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
