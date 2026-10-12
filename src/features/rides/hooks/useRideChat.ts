import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchMyRideChats, fetchRideMessages } from '@/features/rides/chat';
import { supabase } from '@/lib/supabase';

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

/**
 * The car's private channel while its chat is open: a message sent, edited, deleted or reacted to refreshes it at
 * once. Only whoever is in the car gets in (the rule lives in the server, `can_use_ride_topic`). Without the channel
 * the chat still works, refreshing every 15 seconds.
 */
export function useRideChannel(rideId: string | null, enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const cliente = supabase;
    if (!cliente || !rideId || !enabled) return;

    let ativo = true;
    let canal: ReturnType<typeof cliente.channel> | null = null;
    const topico = `realtime:ride:${rideId}`;

    async function entrar() {
      if (!cliente || !rideId) return;
      // A channel for the same car still closing would come back already joined, and could not take listeners.
      for (const antigo of cliente.getChannels().filter((c) => c.topic === topico)) {
        await cliente.removeChannel(antigo);
      }
      if (!ativo || cliente.getChannels().some((c) => c.topic === topico)) return;
      await cliente.realtime.setAuth();
      if (!ativo) return;

      const novo = cliente.channel(`ride:${rideId}`, { config: { private: true } });
      canal = novo;
      novo
        .on('broadcast', { event: 'messages' }, () => {
          void queryClient.invalidateQueries({ queryKey: rideMessagesKey(rideId) });
          void queryClient.invalidateQueries({ queryKey: myRideChatsKey() });
        })
        .subscribe();
    }

    entrar().catch(() => undefined);

    return () => {
      ativo = false;
      if (canal) void cliente.removeChannel(canal);
    };
  }, [rideId, enabled, queryClient]);
}
