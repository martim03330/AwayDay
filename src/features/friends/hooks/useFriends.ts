import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchFriendshipStates,
  fetchMyFriendRequests,
  fetchMyFriends,
  fetchMyGroupInvites,
  fetchMyRideInvites,
  fetchTripCompanions,
} from '@/features/friends/api';

const FRIENDS_KEY = 'friends';
const STALE_MS = 60 * 1000;

export const friendsKey = () => [FRIENDS_KEY, 'list'] as const;
export const friendRequestsKey = () => [FRIENDS_KEY, 'requests'] as const;
export const friendStatesKey = (profileIds: string[]) =>
  [FRIENDS_KEY, 'states', [...profileIds].sort().join(',')] as const;
export const companionsKey = (fixtureId: string | null) =>
  [FRIENDS_KEY, 'companions', fixtureId] as const;
export const groupInvitesKey = () => [FRIENDS_KEY, 'group-invites'] as const;
export const rideInvitesKey = () => [FRIENDS_KEY, 'ride-invites'] as const;

export function useMyFriends(signedIn: boolean) {
  return useQuery({
    queryKey: friendsKey(),
    queryFn: signedIn ? fetchMyFriends : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

export function useMyFriendRequests(signedIn: boolean) {
  return useQuery({
    queryKey: friendRequestsKey(),
    queryFn: signedIn ? fetchMyFriendRequests : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/** Em que pé estás com estas pessoas, para saber que botão mostrar em cada uma. */
export function useFriendshipStates(profileIds: string[], signedIn: boolean) {
  return useQuery({
    queryKey: friendStatesKey(profileIds),
    queryFn:
      signedIn && profileIds.length > 0 ? () => fetchFriendshipStates(profileIds) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/** Quem foi contigo a este jogo. */
export function useTripCompanions(fixtureId: string | null, signedIn: boolean) {
  return useQuery({
    queryKey: companionsKey(fixtureId),
    queryFn: fixtureId && signedIn ? () => fetchTripCompanions(fixtureId) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

export function useMyGroupInvites(signedIn: boolean) {
  return useQuery({
    queryKey: groupInvitesKey(),
    queryFn: signedIn ? fetchMyGroupInvites : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

export function useMyRideInvites(signedIn: boolean) {
  return useQuery({
    queryKey: rideInvitesKey(),
    queryFn: signedIn ? fetchMyRideInvites : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/** Depois de pedir, aceitar ou tirar, tudo o que fala de amigos volta a perguntar ao servidor. */
export function useRefreshFriends() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [FRIENDS_KEY] });
}
