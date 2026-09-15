import { FunctionsHttpError } from '@supabase/supabase-js';

import { RouteRefused, type RoutePoint, type WalkingRoute } from '@/features/routes/types';
import { supabase } from '@/lib/supabase';

// Walking routes come from the `walking-route` Edge Function: the app never calls a routing service itself, and the
// position sent there is not stored.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

async function routeError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const response: unknown = error.context;
    let code: unknown = null;
    if (response instanceof Response) {
      try {
        code = asRecord(await response.json())?.error;
      } catch {
        code = null;
      }
    }
    if (code === 'too_far') return new RouteRefused('too-far');
    if (code === 'no_route') return new RouteRefused('no-route');
    if (code === 'rate_limited') return new RouteRefused('rate-limited');
  }
  return error instanceof Error ? error : new Error('Route failed.');
}

/** The walking route from `from` to `to`, with instructions in Portuguese. */
export async function fetchWalkingRoute(from: RoutePoint, to: RoutePoint): Promise<WalkingRoute> {
  const { data, error } = await client().functions.invoke<unknown>('walking-route', {
    method: 'POST',
    body: { from, to },
  });
  if (error) throw await routeError(error);

  const answer = asRecord(data);
  const path = (Array.isArray(answer?.path) ? answer.path : []).flatMap((pair) =>
    Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number'
      ? [{ latitude: pair[0], longitude: pair[1] }]
      : []
  );
  const steps = (Array.isArray(answer?.steps) ? answer.steps : []).flatMap((item) => {
    const step = asRecord(item);
    return step && typeof step.instruction === 'string' && typeof step.distance_m === 'number'
      ? [{ instruction: step.instruction, distanceM: step.distance_m }]
      : [];
  });
  if (typeof answer?.distance_m !== 'number' || typeof answer.duration_s !== 'number' || path.length < 2) {
    throw new RouteRefused('no-route');
  }
  return {
    distanceM: answer.distance_m,
    durationS: answer.duration_s,
    path,
    steps,
    attribution: typeof answer.attribution === 'string' ? answer.attribution : '© OpenStreetMap',
  };
}
