import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchRideBoard, fetchRidePeople } from '@/features/rides/api';

const RIDES_KEY = 'rides';
const STALE_MS = 30 * 1000;

export const rideBoardKey = (fixtureId: string | null) => [RIDES_KEY, 'board', fixtureId] as const;
export const ridePeopleKey = (rideId: string | null) => [RIDES_KEY, 'people', rideId] as const;

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

export function useRidePeople(rideId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ridePeopleKey(rideId),
    queryFn: rideId && enabled ? () => fetchRidePeople(rideId) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/**
 * Refetches every ride list and passenger list after a change. Queries switched off with `skipToken` (for example
 * the people of a ride the screen has not loaded yet) are left alone: refetching them throws.
 */
export function useRefreshRides() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: [RIDES_KEY],
      predicate: (query) => query.options.queryFn !== skipToken,
    });
}
