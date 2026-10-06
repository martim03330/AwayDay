import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchBlockedPeople, fetchPendingReports } from '@/features/moderation/api';

const MODERATION_KEY = 'moderation';

export const blockedPeopleKey = () => [MODERATION_KEY, 'blocked'] as const;
export const pendingReportsKey = () => [MODERATION_KEY, 'pending-reports'] as const;

export function useBlockedPeople(signedIn: boolean) {
  return useQuery({
    queryKey: blockedPeopleKey(),
    queryFn: signedIn ? fetchBlockedPeople : skipToken,
    staleTime: 60 * 1000,
    meta: { persist: false },
  });
}

export function usePendingReports(isAdmin: boolean) {
  return useQuery({
    queryKey: pendingReportsKey(),
    queryFn: isAdmin ? fetchPendingReports : skipToken,
    staleTime: 30 * 1000,
    meta: { persist: false },
  });
}

/**
 * After a block, an unblock or a hidden message, a lot changes at once: chats, chat lists, friends, invites. A
 * block is rare, so everything on screen is simply asked again rather than chasing every query key.
 */
export function useRefreshAfterModeration() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}
