import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  fetchGroupMembers,
  fetchGroupMessages,
  fetchGroupPlans,
  fetchGroupTrips,
  fetchMyGroupInbox,
} from '@/features/groups/api';
import {
  fetchGroupFixturePlans,
  fetchPlanHouses,
  fetchPlanPeople,
  fetchPlans,
} from '@/features/groups/plans';
import { supabase } from '@/lib/supabase';

// Os ecrãs antigos dos grupos já invalidavam ['groups']: as chaves daqui continuam debaixo desse prefixo.
const GROUPS_KEY = 'groups';

export const groupInboxKey = () => [GROUPS_KEY, 'inbox'] as const;
export const groupMessagesKey = (groupId: string | null) =>
  [GROUPS_KEY, 'messages', groupId] as const;
/** Tudo o que é de planos fica debaixo desta chave: uma resposta nova refresca cartões, listas e pessoas. */
export const plansKey = () => [GROUPS_KEY, 'fixture-plans'] as const;

/** A lista da Malta. Sem Realtime aqui: volta a perguntar de minuto a minuto, e quando se volta ao ecrã. */
export function useMyGroupInbox(signedIn: boolean) {
  return useQuery({
    queryKey: groupInboxKey(),
    queryFn: signedIn ? fetchMyGroupInbox : skipToken,
    staleTime: 20 * 1000,
    refetchInterval: 60 * 1000,
    meta: { persist: false },
  });
}

/** Um grupo da lista, pelo id. */
export function useGroupFromInbox(groupId: string | null, signedIn: boolean) {
  const inbox = useMyGroupInbox(signedIn);
  return {
    ...inbox,
    group: (inbox.data ?? []).find((candidato) => candidato.id === groupId) ?? null,
  };
}

/**
 * As mensagens da conversa aberta. As novas chegam pelo canal do grupo (ver `useGroupChannel`); o intervalo é só
 * uma rede de segurança para quando o canal cai (rede fraca à porta do estádio).
 */
export function useGroupMessages(groupId: string | null) {
  return useQuery({
    queryKey: groupMessagesKey(groupId),
    queryFn: groupId ? () => fetchGroupMessages(groupId) : skipToken,
    staleTime: 5 * 1000,
    refetchInterval: 30 * 1000,
    meta: { persist: false },
  });
}

export function useGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: [GROUPS_KEY, 'members', groupId],
    queryFn: groupId ? () => fetchGroupMembers(groupId) : skipToken,
    meta: { persist: false },
  });
}

export function useGroupPlans(groupId: string | null) {
  return useQuery({
    queryKey: [GROUPS_KEY, 'plans', groupId],
    queryFn: groupId ? () => fetchGroupPlans(groupId) : skipToken,
    meta: { persist: false },
  });
}

export function useGroupTrips(groupId: string | null) {
  return useQuery({
    queryKey: [GROUPS_KEY, 'trips', groupId],
    queryFn: groupId ? () => fetchGroupTrips(groupId) : skipToken,
    meta: { persist: false },
  });
}

/** Os planos dos cartões de uma conversa. */
export function usePlans(planIds: string[]) {
  const ids = [...new Set(planIds)].sort();
  return useQuery({
    queryKey: [...plansKey(), 'by-id', ids.join(',')],
    queryFn: ids.length > 0 ? () => fetchPlans(ids) : skipToken,
    staleTime: 10 * 1000,
    meta: { persist: false },
  });
}

export function usePlan(planId: string | null) {
  const planos = usePlans(planId ? [planId] : []);
  return { ...planos, plan: planos.data?.[0] ?? null };
}

/** Os planos em aberto de um grupo. */
export function useGroupFixturePlans(groupId: string | null) {
  return useQuery({
    queryKey: [...plansKey(), 'group', groupId],
    queryFn: groupId ? () => fetchGroupFixturePlans(groupId) : skipToken,
    staleTime: 10 * 1000,
    meta: { persist: false },
  });
}

export function usePlanPeople(planId: string | null) {
  return useQuery({
    queryKey: [...plansKey(), 'people', planId],
    queryFn: planId ? () => fetchPlanPeople(planId) : skipToken,
    staleTime: 10 * 1000,
    meta: { persist: false },
  });
}

/** As casas propostas para o plano, com as preferências. */
export function usePlanHouses(planId: string | null) {
  return useQuery({
    queryKey: [...plansKey(), 'houses', planId],
    queryFn: planId ? () => fetchPlanHouses(planId) : skipToken,
    staleTime: 10 * 1000,
    meta: { persist: false },
  });
}

export function useRefreshGroups() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [GROUPS_KEY] });
}

/**
 * O canal privado do grupo, enquanto a conversa está aberta: quem mais a tem aberta («online») e o aviso de que há
 * mensagens novas. Só entra quem é do grupo — a regra vive no servidor (`realtime.messages`).
 *
 * Devolve quantas pessoas **diferentes** estão online, contando contigo.
 */
export function useGroupChannel(groupId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState<string[]>([]);

  useEffect(() => {
    const cliente = supabase;
    if (!cliente || !groupId || !userId) return;

    let ativo = true;
    const canal = cliente.channel(`group:${groupId}`, {
      config: { private: true, presence: { key: userId } },
    });

    canal
      .on('presence', { event: 'sync' }, () => {
        if (!ativo) return;
        setOnline(Object.keys(canal.presenceState()));
      })
      .on('broadcast', { event: 'messages' }, () => {
        void queryClient.invalidateQueries({ queryKey: groupMessagesKey(groupId) });
        void queryClient.invalidateQueries({ queryKey: groupInboxKey() });
      })
      // Alguém respondeu a um plano, ou o plano fechou: os cartões mudam.
      .on('broadcast', { event: 'plans' }, () => {
        void queryClient.invalidateQueries({ queryKey: plansKey() });
      });

    // Um canal privado precisa do token da sessão antes de entrar.
    void cliente.realtime.setAuth().then(() => {
      if (!ativo) return;
      canal.subscribe((estado) => {
        if (estado === 'SUBSCRIBED') void canal.track({ at: new Date().toISOString() });
      });
    });

    return () => {
      ativo = false;
      setOnline([]);
      void cliente.removeChannel(canal);
    };
  }, [groupId, userId, queryClient]);

  return online;
}
