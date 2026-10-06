import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchMyOpenTripSessions,
  fetchTripSessionCards,
  fetchMyLiveTrips,
  fetchMyTripAccounts,
  fetchTripStartOptions,
  fetchMyTripHistory,
  fetchRideTripSession,
  fetchTripBalances,
  fetchTripExpenses,
  fetchTripPeople,
  fetchTripPeopleToAdd,
  fetchTripSettlements,
  fetchTripSession,
} from '@/features/trips/api';
import { fetchTripMemory, fetchTripPhotos } from '@/features/trips/memories';

const TRIPS_KEY = 'trips';
const STALE_MS = 15 * 1000;

export const tripSessionKey = (groupId: string | null, fixtureId: string | null) =>
  [TRIPS_KEY, 'session', groupId, fixtureId] as const;
export const tripExpensesKey = (sessionId: string | null) =>
  [TRIPS_KEY, 'expenses', sessionId] as const;
export const tripAccountsKey = (fixtureId: string | null) =>
  [TRIPS_KEY, 'mine', fixtureId] as const;
export const tripStartOptionsKey = (fixtureId: string | null) =>
  [TRIPS_KEY, 'start', fixtureId] as const;
export const tripCandidatesKey = (sessionId: string | null) =>
  [TRIPS_KEY, 'candidates', sessionId] as const;
export const rideSessionKey = (rideId: string | null) => [TRIPS_KEY, 'ride', rideId] as const;
export const tripPeopleKey = (sessionId: string | null) =>
  [TRIPS_KEY, 'people', sessionId] as const;
export const liveTripsKey = () => [TRIPS_KEY, 'live'] as const;
export const tripHistoryKey = () => [TRIPS_KEY, 'history'] as const;
export const tripSettlementsKey = (sessionId: string | null) =>
  [TRIPS_KEY, 'settlements', sessionId] as const;
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

/** As contas deste jogo que me dizem respeito: dos meus grupos e das boleias em que vou. */
export function useMyTripAccounts(fixtureId: string | null, signedIn: boolean) {
  return useQuery({
    queryKey: tripAccountsKey(fixtureId),
    queryFn: fixtureId && signedIn ? () => fetchMyTripAccounts(fixtureId) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/** Por onde se podem começar as contas deste jogo. */
export function useTripStartOptions(fixtureId: string | null, signedIn: boolean) {
  return useQuery({
    queryKey: tripStartOptionsKey(fixtureId),
    queryFn: fixtureId && signedIn ? () => fetchTripStartOptions(fixtureId) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/** Quem pode entrar nestas contas e ainda não está. */
export function useTripPeopleToAdd(sessionId: string | null) {
  return useQuery({
    queryKey: tripCandidatesKey(sessionId),
    queryFn: sessionId ? () => fetchTripPeopleToAdd(sessionId) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/** As contas de uma boleia, se já alguém as abriu. */
export function useRideTripSession(rideId: string | null, signedIn: boolean) {
  return useQuery({
    queryKey: rideSessionKey(rideId),
    queryFn: rideId && signedIn ? () => fetchRideTripSession(rideId) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/** Quem entra nestas contas: os do grupo, ou os do carro. */
export function useTripPeople(sessionId: string | null) {
  return useQuery({
    queryKey: tripPeopleKey(sessionId),
    queryFn: sessionId ? () => fetchTripPeople(sessionId) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/**
 * A viagem que está a acontecer agora. Vive na primeira página enquanto durar, e é por isso que se refresca
 * depressa: o que interessa é a malta ir lançando o que paga, não lembrar-se de tudo no fim.
 */
export function useMyLiveTrips(signedIn: boolean) {
  return useQuery({
    queryKey: liveTripsKey(),
    queryFn: signedIn ? fetchMyLiveTrips : skipToken,
    staleTime: STALE_MS,
    refetchInterval: 60 * 1000,
    meta: { persist: false },
  });
}

/** O dinheiro que já mudou de mãos nestas contas. */
export function useTripSettlements(sessionId: string | null) {
  return useQuery({
    queryKey: tripSettlementsKey(sessionId),
    queryFn: sessionId ? () => fetchTripSettlements(sessionId) : skipToken,
    staleTime: STALE_MS,
    refetchInterval: 60 * 1000,
    meta: { persist: false },
  });
}

/** Os jogos a que já foste acompanhado: com quem foste e o que se gastou. */
export function useMyTripHistory(signedIn: boolean) {
  return useQuery({
    queryKey: tripHistoryKey(),
    queryFn: signedIn ? fetchMyTripHistory : skipToken,
    staleTime: 5 * 60 * 1000,
    meta: { persist: false },
  });
}

/** Depois de mexer nas contas, tudo o que está a olhar para elas volta a perguntar ao servidor. */
export function useRefreshTrips() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [TRIPS_KEY] });
}

export const openSessionsKey = () => [TRIPS_KEY, 'open-sessions'] as const;

/** As sessões da viagem abertas agora, para a página dos Jogos. */
export function useMyOpenTripSessions(signedIn: boolean) {
  return useQuery({
    queryKey: openSessionsKey(),
    queryFn: signedIn ? fetchMyOpenTripSessions : skipToken,
    staleTime: 30 * 1000,
    refetchInterval: 2 * 60 * 1000,
    meta: { persist: false },
  });
}

/** O cartão de uma sessão, para o ecrã da sessão e das despesas. */
export function useTripSessionCard(sessionId: string | null) {
  const cartao = useQuery({
    queryKey: [TRIPS_KEY, 'card', sessionId],
    queryFn: sessionId ? () => fetchTripSessionCards([sessionId]) : skipToken,
    staleTime: STALE_MS,
    refetchInterval: 60 * 1000,
    meta: { persist: false },
  });
  return { ...cartao, card: cartao.data?.[0] ?? null };
}

/** A viagem como recordação: quem foi, o dinheiro, a maior extravagância. */
export function useTripMemory(sessionId: string | null) {
  return useQuery({
    queryKey: [TRIPS_KEY, 'memory', sessionId],
    queryFn: sessionId ? () => fetchTripMemory(sessionId) : skipToken,
    staleTime: 60 * 1000,
    meta: { persist: false },
  });
}

/** O álbum da viagem, com links assinados (duram uma hora; a consulta volta a pedir muito antes). */
export function useTripPhotos(sessionId: string | null) {
  return useQuery({
    queryKey: [TRIPS_KEY, 'photos', sessionId],
    queryFn: sessionId ? () => fetchTripPhotos(sessionId) : skipToken,
    staleTime: 10 * 60 * 1000,
    meta: { persist: false },
  });
}
