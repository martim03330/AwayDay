// Which routes a driver is offered, out of every route the router gave (several levels of toll avoidance, each with
// an alternative). Pure, no imports beyond types, so the app's tests can load it; the `rides` Edge Function runs it
// for the quote and again, with the same cached routes, when the ride is created.
//
// - «rapida»: the fastest;
// - «equilibrio» («Menos portagens»): a route that still uses some motorway but pays fewer tolls (Coimbra → Lisboa by
//   the free A13 and the A23, then the A1 only from Torres Novas). Of those that save real money and do not take much
//   longer, the one where the saving is worth most once each extra minute at the wheel is counted against it: by the
//   A19 and national roads, 23 € cheaper but 30 min slower each way, loses to the A13, 14,50 € cheaper and 4 min slower;
// - «sem_portagens»: the cheapest without any toll.
// An option that is both slower and dearer than another one is left out: nobody would pick it.

import type { TripCost } from './ride-cost.ts';
import type { Route } from './route-parse.ts';

export type RouteOption = 'rapida' | 'equilibrio' | 'sem_portagens';
export type Candidate = { route: Route; cost: TripCost };
export type Choice = { option: RouteOption; candidate: Candidate };

/** «Equilíbrio» has to save at least this much on the whole trip (fuel and tolls, both ways if it comes back). */
export const MIN_SAVING_CENTS = 150;
/** …and may take at most this much longer than the fastest. */
export const MAX_EXTRA_S = 45 * 60;
/** What a minute more at the wheel costs, for weighing a saving against the time it takes (24 € an hour). */
export const MINUTE_CENTS = 40;

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

/**
 * The routes to offer, fastest first. Empty when there is no route at all. `ways` is 2 when the driver comes back
 * too: the cost already counts both ways, so the extra time does as well.
 */
export function chooseRoutes(candidates: readonly Candidate[], ways: 1 | 2 = 1): Choice[] {
  const unique: Candidate[] = [];
  for (const candidate of [...candidates].sort(fastestFirst)) {
    if (!unique.some((kept) => sameRoute(kept.route, candidate.route))) unique.push(candidate);
  }
  const rapida = unique[0];
  if (!rapida) return [];

  const semPortagens = unique.filter((c) => c.route.tollM === 0 && c !== rapida).sort(cheapestFirst)[0];

  /** The saving over the fastest, less what the extra minutes are worth. */
  const worth = (c: Candidate) =>
    rapida.cost.totalCents -
    c.cost.totalCents -
    Math.max(0, c.route.durationS - rapida.route.durationS) * ways * (MINUTE_CENTS / 60);
  const equilibrio = unique
    .filter(
      (c) =>
        c !== rapida &&
        c.route.tollM > 0 &&
        c.cost.totalCents <= rapida.cost.totalCents - MIN_SAVING_CENTS &&
        c.route.durationS <= rapida.route.durationS + MAX_EXTRA_S &&
        worth(c) > 0
    )
    .sort((a, b) => worth(b) - worth(a) || cheapestFirst(a, b))[0];

  const choices: Choice[] = [{ option: 'rapida', candidate: rapida }];
  if (equilibrio && !(semPortagens && dominated(equilibrio, semPortagens))) {
    choices.push({ option: 'equilibrio', candidate: equilibrio });
  }
  if (semPortagens && !dominated(semPortagens, rapida)) {
    choices.push({ option: 'sem_portagens', candidate: semPortagens });
  }
  return choices;
}
