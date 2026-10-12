import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import {
  editGroupMessage,
  fetchGroupMembers,
  fetchGroupMessages,
  fetchGroupPlans,
  fetchGroupTrips,
  fetchMyGroupInbox,
  reactGroupMessage,
  removeGroupMessage,
  sendGroupMessage,
  type GroupMessage,
} from '@/features/groups/api';
import {
  fetchGroupFixturePlans,
  fetchMyPlanConflicts,
  fetchPlanHouses,
  fetchPlanPeople,
  fetchPlanSharedGroups,
  fetchPlans,
} from '@/features/groups/plans';
import { fetchGroupHistory } from '@/features/groups/history';
import { comAMinhaReacao, idLocal, type Emoji } from '@/lib/conversa';
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

/** Os planos em que já vou a esse jogo com outro grupo: `{ planoId: nome do outro grupo }`. */
export function usePlanConflicts(planIds: string[]) {
  const ids = [...new Set(planIds)].sort();
  return useQuery({
    queryKey: [...plansKey(), 'conflicts', ids.join(',')],
    queryFn: ids.length > 0 ? () => fetchMyPlanConflicts(ids) : skipToken,
    staleTime: 10 * 1000,
    meta: { persist: false },
  });
}

export function usePlan(planId: string | null) {
  const planos = usePlans(planId ? [planId] : []);
  return { ...planos, plan: planos.data?.[0] ?? null };
}

/** Os planos de um grupo. */
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

/** A que grupos o plano foi mandado (vazio para quem não é do grupo de origem). */
export function usePlanSharedGroups(planId: string | null) {
  return useQuery({
    queryKey: [...plansKey(), 'shared', planId],
    queryFn: planId ? () => fetchPlanSharedGroups(planId) : skipToken,
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

/** O histórico do grupo: as viagens já feitas, com pelo menos duas pessoas do grupo. */
export function useGroupHistory(groupId: string | null) {
  return useQuery({
    queryKey: [GROUPS_KEY, 'history', groupId],
    queryFn: groupId ? () => fetchGroupHistory(groupId) : skipToken,
    staleTime: 60 * 1000,
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
    let canal: ReturnType<typeof cliente.channel> | null = null;
    const topico = `realtime:group:${groupId}`;

    async function entrar() {
      if (!cliente || !groupId || !userId) return;
      // Um canal do mesmo grupo que ainda está a fechar (voltaste a abrir a conversa depressa) seria devolvido tal e
      // qual pelo `channel()`, já ligado — e aí não se lhe podem juntar ouvintes. Espera-se que feche primeiro.
      for (const antigo of cliente.getChannels().filter((c) => c.topic === topico)) {
        await cliente.removeChannel(antigo);
      }
      if (!ativo || cliente.getChannels().some((c) => c.topic === topico)) return;

      // Um canal privado precisa do token da sessão antes de entrar.
      await cliente.realtime.setAuth();
      if (!ativo) return;

      const novo = cliente.channel(`group:${groupId}`, {
        config: { private: true, presence: { key: userId } },
      });
      canal = novo;
      novo
        .on('presence', { event: 'sync' }, () => {
          if (!ativo) return;
          setOnline(Object.keys(novo.presenceState()));
        })
        .on('broadcast', { event: 'messages' }, () => {
          void queryClient.invalidateQueries({ queryKey: groupMessagesKey(groupId) });
          void queryClient.invalidateQueries({ queryKey: groupInboxKey() });
        })
        // Alguém respondeu a um plano, ou o plano fechou: os cartões mudam.
        .on('broadcast', { event: 'plans' }, () => {
          void queryClient.invalidateQueries({ queryKey: plansKey() });
        })
        .subscribe((estado) => {
          if (estado === 'SUBSCRIBED') void novo.track({ at: new Date().toISOString() });
        });
    }

    // Sem canal, a conversa continua a funcionar (volta a perguntar de 30 em 30 segundos); só se perde o «online».
    entrar().catch(() => undefined);

    return () => {
      ativo = false;
      setOnline([]);
      if (canal) void cliente.removeChannel(canal);
    };
  }, [groupId, userId, queryClient]);

  return online;
}

/**
 * What you do in a group chat shows at once, like in any messaging app: the message, the reaction, the edit or the
 * deletion goes into the list straight away and the server confirms it behind. If the server refuses, the list goes
 * back to what the server has (and `enviar` throws, so the screen can give the text back).
 */
export function useGroupChatActions(groupId: string | null, eu: { profileId: string; nome: string } | null) {
  const queryClient = useQueryClient();
  const chave = groupMessagesKey(groupId);
  // Messages still on their way: the list is only fetched again once none is left, or a refetch would drop them.
  const aCaminho = useRef(0);

  async function mudarLista(mudar: (lista: GroupMessage[]) => GroupMessage[]) {
    await queryClient.cancelQueries({ queryKey: chave });
    queryClient.setQueryData<GroupMessage[]>(chave, (lista) => mudar(lista ?? []));
  }

  function confirmar() {
    if (aCaminho.current > 0) return;
    void queryClient.invalidateQueries({ queryKey: chave });
    void queryClient.invalidateQueries({ queryKey: groupInboxKey() });
  }

  async function enviar(
    texto: string,
    resposta: GroupMessage | null,
    mencoes: { ids: string[]; todos: boolean } = { ids: [], todos: false }
  ) {
    if (!groupId || !eu) return;
    const local: GroupMessage = {
      id: idLocal(Date.now()),
      profileId: eu.profileId,
      displayName: eu.nome,
      kind: 'texto',
      body: texto.trim(),
      placeId: null,
      planId: null,
      mine: true,
      canRemove: false,
      createdAt: new Date().toISOString(),
      editedAt: null,
      replyTo: resposta
        ? { id: resposta.id, displayName: resposta.displayName, body: resposta.body }
        : null,
      reactions: [],
      mentionsMe: false,
    };
    aCaminho.current += 1;
    // Newest first: the list is drawn from the bottom up.
    await mudarLista((lista) => [local, ...lista]);
    try {
      const id = await sendGroupMessage(groupId, texto, resposta?.id ?? null, mencoes);
      queryClient.setQueryData<GroupMessage[]>(chave, (lista) =>
        (lista ?? []).map((mensagem) =>
          mensagem.id === local.id ? { ...mensagem, id, canRemove: true } : mensagem
        )
      );
    } catch (erro) {
      queryClient.setQueryData<GroupMessage[]>(chave, (lista) =>
        (lista ?? []).filter((mensagem) => mensagem.id !== local.id)
      );
      throw erro;
    } finally {
      aCaminho.current -= 1;
      confirmar();
    }
  }

  async function reagir(mensagem: GroupMessage, emoji: Emoji | null) {
    await mudarLista((lista) =>
      lista.map((outra) =>
        outra.id === mensagem.id ? { ...outra, reactions: comAMinhaReacao(outra.reactions, emoji) } : outra
      )
    );
    try {
      await reactGroupMessage(mensagem.id, emoji);
    } finally {
      confirmar();
    }
  }

  async function editar(mensagem: GroupMessage, texto: string) {
    await mudarLista((lista) =>
      lista.map((outra) =>
        outra.id === mensagem.id
          ? { ...outra, body: texto.trim(), editedAt: new Date().toISOString() }
          : outra
      )
    );
    try {
      await editGroupMessage(mensagem.id, texto);
    } finally {
      confirmar();
    }
  }

  async function apagar(mensagem: GroupMessage) {
    await mudarLista((lista) => lista.filter((outra) => outra.id !== mensagem.id));
    try {
      await removeGroupMessage(mensagem.id);
    } finally {
      confirmar();
    }
  }

  return { enviar, reagir, editar, apagar };
}
