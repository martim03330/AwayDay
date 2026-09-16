import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMyRideChats, fetchRideMessages } from '@/features/rides/chat';

const CHAT_KEY = 'ride-chat';

export const rideMessagesKey = (rideId: string | null) => [CHAT_KEY, 'messages', rideId] as const;
export const myRideChatsKey = () => [CHAT_KEY, 'mine'] as const;

/** A conversa aberta no ecrã: refresca depressa, que é uma conversa. */
export function useRideMessages(rideId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: rideMessagesKey(rideId),
    queryFn: rideId && enabled ? () => fetchRideMessages(rideId) : skipToken,
    staleTime: 5 * 1000,
    refetchInterval: 15 * 1000,
    meta: { persist: false },
  });
}

/** O que está por ler nas boleias em que vou, para o aviso aparecer no sítio certo. */
export function useMyRideChats(signedIn: boolean) {
  return useQuery({
    queryKey: myRideChatsKey(),
    queryFn: signedIn ? fetchMyRideChats : skipToken,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    meta: { persist: false },
  });
}

export function useRefreshRideChat() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [CHAT_KEY] });
}
