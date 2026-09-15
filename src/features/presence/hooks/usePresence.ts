import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchNoiseRanking,
  fetchPlacePulse,
  fetchVerifiedPlacesRanking,
} from '@/features/presence/api';

const PRESENCE_KEY = 'presence';
const MINUTE_MS = 60 * 1000;

export const placePulseKey = [PRESENCE_KEY, 'pulse'] as const;

/** Everything ranking-related for one user; invalidate it after a check-in or a visibility change. */
export function rankingsKey(userId: string | null) {
  return [PRESENCE_KEY, 'rankings', userId] as const;
}

/** How many people are at each tasco right now. Refreshed every minute while enabled; never persisted. */
export function usePlacePulse(enabled: boolean) {
  return useQuery({
    queryKey: placePulseKey,
    queryFn: fetchPlacePulse,
    enabled,
    staleTime: 30 * 1000,
    refetchInterval: enabled ? MINUTE_MS : false,
    meta: { persist: false },
  });
}

export function useVerifiedPlacesRanking(userId: string | null) {
  return useQuery({
    queryKey: [...rankingsKey(userId), 'places'],
    queryFn: userId ? fetchVerifiedPlacesRanking : skipToken,
    staleTime: MINUTE_MS,
  });
}

export function useNoiseRanking(userId: string | null, fixtureId: string) {
  return useQuery({
    queryKey: [...rankingsKey(userId), 'noise', fixtureId],
    queryFn: userId ? () => fetchNoiseRanking(fixtureId) : skipToken,
    staleTime: 30 * 1000,
    refetchInterval: userId ? MINUTE_MS : false,
  });
}

/** Refetches presence and rankings after the user's own check-in changes. */
export function useRefreshPresence(userId: string | null) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: placePulseKey }),
      queryClient.invalidateQueries({ queryKey: rankingsKey(userId) }),
    ]);
}
