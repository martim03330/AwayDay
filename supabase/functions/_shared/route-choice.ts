// Which routes a driver is offered, out of every route the router gave (several levels of toll avoidance, each with
// an alternative). Pure, no imports beyond types, so the app's tests can load it; the `rides` Edge Function runs it
// for the quote and again, with the same cached routes, when the ride is created.
//
// - «rapida»: the fastest;
// - «equilibrio»: the cheapest route that still uses some motorway (say, the A13 for part of the way instead of the
//   A1), only when it saves real money and does not take much longer;
// - «sem_portagens»: the cheapest without any toll.
// An option that is both slower and dearer than another one is left out: nobody would pick it.

import type { TollSegment, TripCost } from './ride-cost.ts';
import type { Route } from './route-parse.ts';

export type RouteOption = 'rapida' | 'equilibrio' | 'sem_portagens';
export type Candidate = { route: Route; cost: TripCost };
export type Choice = { option: RouteOption; candidate: Candidate };

/** «Equilíbrio» has to save at least this much on the whole trip (fuel and tolls, both ways if it comes back). */
export const MIN_SAVING_CENTS = 150;
/** …and may take at most this much longer than the fastest. */
export const MAX_EXTRA_S = 45 * 60;

/** Two answers of the router that are the same road: within 1 % of distance and 1 km of tolled road. */
export function sameRoute(a: Route, b: Route) {
  return Math.abs(a.distanceM - b.distanceM) <= Math.max(a.distanceM, b.distanceM) * 0.01 && Math.abs(a.tollM - b.tollM) <= 1000;
}

function cheapestFirst(a: Candidate, b: Candidate) {
  return a.cost.totalCents - b.cost.totalCents || a.route.durationS - b.route.durationS;
}

function fastestFirst(a: Candidate, b: Candidate) {
  return a.route.durationS - b.route.durationS || a.cost.totalCents - b.cost.totalCents;
}

/** `a` is no better than `b` on time nor on money, and worse on one of them. */
function dominated(a: Candidate, b: Candidate) {
  const noBetter = a.route.durationS >= b.route.durationS && a.cost.totalCents >= b.cost.totalCents;
  return noBetter && (a.route.durationS > b.route.durationS || a.cost.totalCents > b.cost.totalCents);
}

/** The routes to offer, fastest first. Empty when there is no route at all. */
export function chooseRoutes(candidates: readonly Candidate[]): Choice[] {
  const unique: Candidate[] = [];
  for (const candidate of [...candidates].sort(fastestFirst)) {
    if (!unique.some((kept) => sameRoute(kept.route, candidate.route))) unique.push(candidate);
  }
  const rapida = unique[0];
  if (!rapida) return [];

  const semPortagens = unique.filter((c) => c.route.tollM === 0 && c !== rapida).sort(cheapestFirst)[0];

  const equilibrio = unique
    .filter(
      (c) =>
        c !== rapida &&
        c.route.tollM > 0 &&
        c.cost.totalCents <= rapida.cost.totalCents - MIN_SAVING_CENTS &&
        c.route.durationS <= rapida.route.durationS + MAX_EXTRA_S
    )
    .sort(cheapestFirst)[0];

  const choices: Choice[] = [{ option: 'rapida', candidate: rapida }];
  if (equilibrio && !(semPortagens && dominated(equilibrio, semPortagens))) {
    choices.push({ option: 'equilibrio', candidate: equilibrio });
  }
  if (semPortagens && !dominated(semPortagens, rapida)) {
    choices.push({ option: 'sem_portagens', candidate: semPortagens });
  }
  return choices;
}

/** The motorways of a route in the order they are driven, each once, skipping bits under 1 km ("A13", "A1"). */
export function motorwaysOf(segments: readonly TollSegment[]): string[] {
  const metres = new Map<string, number>();
  for (const segment of segments) {
    if (segment.motorway === 'default') continue;
    metres.set(segment.motorway, (metres.get(segment.motorway) ?? 0) + segment.tollM);
  }
  return [...metres].filter(([, total]) => total >= 1000).map(([motorway]) => motorway);
}
