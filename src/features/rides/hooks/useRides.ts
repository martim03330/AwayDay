import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchReturnBoard,
  fetchReturnPeople,
  fetchRideBoard,
  fetchRidePeople,
  fetchRideRouteVia,
} from '@/features/rides/api';

const RIDES_KEY = 'rides';
const STALE_MS = 30 * 1000;

export const rideBoardKey = (fixtureId: string | null) => [RIDES_KEY, 'board', fixtureId] as const;
export const ridePeopleKey = (rideId: string | null) => [RIDES_KEY, 'people', rideId] as const;
export const returnBoardKey = (fixtureId: string | null) =>
  [RIDES_KEY, 'return', fixtureId] as const;
export const returnPeopleKey = (rideId: string | null) =>
  [RIDES_KEY, 'return-people', rideId] as const;

/** The rides for a game; idle without an account (the board needs one). */
export function useRideBoard(fixtureId: string | null, signedIn: boolean) {
  return useQuery({
    queryKey: rideBoardKey(fixtureId),
    queryFn: fixtureId && signedIn ? () => fetchRideBoard(fixtureId) : skipToken,
    staleTime: STALE_MS,
    // Seats change while someone looks at the list: refresh now and then.
    refetchInterval: 60 * 1000,
    meta: { persist: false },
  });
}

/** The points of the road the driver picked; they never change once the ride exists. */
export function useRideRouteVia(rideId: string | null) {
  return useQuery({
    queryKey: [RIDES_KEY, 'route-via', rideId] as const,
    queryFn: rideId ? () => fetchRideRouteVia(rideId) : skipToken,
    staleTime: Infinity,
    meta: { persist: false },
  });
}

export function useRidePeople(rideId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ridePeopleKey(rideId),
    queryFn: rideId && enabled ? () => fetchRidePeople(rideId) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/**
 * Cars going home from this game with room left. Only while the window is open (the server returns nothing outside
 * it), and it refreshes fast: whoever is asking is standing outside the stadium.
 */
export function useReturnBoard(fixtureId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: returnBoardKey(fixtureId),
    queryFn: fixtureId && enabled ? () => fetchReturnBoard(fixtureId) : skipToken,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    meta: { persist: false },
  });
}

/** Who asked this ride for a seat home. The driver has minutes to answer, so this refreshes fast too. */
export function useReturnPeople(rideId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: returnPeopleKey(rideId),
    queryFn: rideId && enabled ? () => fetchReturnPeople(rideId) : skipToken,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    meta: { persist: false },
  });
}

/**
 * Refetches every ride list and passenger list after a change. Queries switched off with `skipToken` (for example
 * the people of a ride the screen has not loaded yet) are left alone: refetching them throws.
 */
export function useRefreshRides() {
  const queryClient = useQueryClient();
  return () => {
    const ligada = (query: { options: { queryFn?: unknown } }) => query.options.queryFn !== skipToken;
    // A seat accepted or a car offered marks the game as «vou» on the server: the ticket and the count follow.
    void queryClient.invalidateQueries({ queryKey: ['attendance'], predicate: ligada });
    void queryClient.invalidateQueries({ queryKey: ['going-count'], predicate: ligada });
    return queryClient.invalidateQueries({ queryKey: [RIDES_KEY], predicate: ligada });
  };
}
