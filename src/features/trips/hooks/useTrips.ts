import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchMyTripSessions,
  fetchTripBalances,
  fetchTripExpenses,
  fetchTripSession,
} from '@/features/trips/api';

const TRIPS_KEY = 'trips';
const STALE_MS = 15 * 1000;

export const tripSessionKey = (groupId: string | null, fixtureId: string | null) =>
  [TRIPS_KEY, 'session', groupId, fixtureId] as const;
export const tripExpensesKey = (sessionId: string | null) =>
  [TRIPS_KEY, 'expenses', sessionId] as const;
export const myTripSessionsKey = (fixtureId: string | null) =>
  [TRIPS_KEY, 'mine', fixtureId] as const;
export const tripBalancesKey = (sessionId: string | null) =>
  [TRIPS_KEY, 'balances', sessionId] as const;

export function useTripSession(groupId: string | null, fixtureId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: tripSessionKey(groupId, fixtureId),
    queryFn:
      groupId && fixtureId && enabled ? () => fetchTripSession(groupId, fixtureId) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/** As despesas do dia. Enquanto a malta anda a lançar contas, isto muda a cada minuto. */
export function useTripExpenses(sessionId: string | null) {
  return useQuery({
    queryKey: tripExpensesKey(sessionId),
    queryFn: sessionId ? () => fetchTripExpenses(sessionId) : skipToken,
    staleTime: STALE_MS,
    refetchInterval: 60 * 1000,
    meta: { persist: false },
  });
}

export function useTripBalances(sessionId: string | null) {
  return useQuery({
    queryKey: tripBalancesKey(sessionId),
    queryFn: sessionId ? () => fetchTripBalances(sessionId) : skipToken,
    staleTime: STALE_MS,
    refetchInterval: 60 * 1000,
    meta: { persist: false },
  });
}

/** Em que grupos meus há contas deste jogo. É o que o ecrã do jogo mostra. */
export function useMyTripSessions(fixtureId: string | null, signedIn: boolean) {
  return useQuery({
    queryKey: myTripSessionsKey(fixtureId),
    queryFn: fixtureId && signedIn ? () => fetchMyTripSessions(fixtureId) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/** Depois de mexer nas contas, tudo o que está a olhar para elas volta a perguntar ao servidor. */
export function useRefreshTrips() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [TRIPS_KEY] });
}
