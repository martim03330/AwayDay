import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import {
  editRideMessage,
  fetchMyRideChats,
  fetchRideMessages,
  reactRideMessage,
  removeRideMessage,
  sendRideMessage,
  type RideMessage,
} from '@/features/rides/chat';
import { comAMinhaReacao, idLocal, type Emoji } from '@/lib/conversa';
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

/**
 * What you do in the car chat shows at once; the server confirms behind (same as the group chat). If the server
 * refuses, the list goes back to what the server has, and `enviar` throws so the screen can give the text back.
 */
export function useRideChatActions(rideId: string | null, eu: { profileId: string; nome: string } | null) {
  const queryClient = useQueryClient();
  const chave = rideMessagesKey(rideId);
  const aCaminho = useRef(0);

  async function mudarLista(mudar: (lista: RideMessage[]) => RideMessage[]) {
    await queryClient.cancelQueries({ queryKey: chave });
    queryClient.setQueryData<RideMessage[]>(chave, (lista) => mudar(lista ?? []));
  }

  function confirmar() {
    if (aCaminho.current > 0) return;
    void queryClient.invalidateQueries({ queryKey: chave });
    void queryClient.invalidateQueries({ queryKey: myRideChatsKey() });
  }

  async function enviar(
    texto: string,
    resposta: RideMessage | null,
    mencoes: { ids: string[]; todos: boolean } = { ids: [], todos: false }
  ) {
    if (!rideId || !eu) return;
    const local: RideMessage = {
      id: idLocal(Date.now()),
      profileId: eu.profileId,
      displayName: eu.nome,
      body: texto.trim(),
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
    // Oldest first: the new one goes at the end.
    await mudarLista((lista) => [...lista, local]);
    try {
      const id = await sendRideMessage(rideId, texto, resposta?.id ?? null, mencoes);
      queryClient.setQueryData<RideMessage[]>(chave, (lista) =>
        (lista ?? []).map((mensagem) =>
          mensagem.id === local.id ? { ...mensagem, id, canRemove: true } : mensagem
        )
      );
    } catch (erro) {
      queryClient.setQueryData<RideMessage[]>(chave, (lista) =>
        (lista ?? []).filter((mensagem) => mensagem.id !== local.id)
      );
      throw erro;
    } finally {
      aCaminho.current -= 1;
      confirmar();
    }
  }

  async function reagir(mensagem: RideMessage, emoji: Emoji | null) {
    await mudarLista((lista) =>
      lista.map((outra) =>
        outra.id === mensagem.id ? { ...outra, reactions: comAMinhaReacao(outra.reactions, emoji) } : outra
      )
    );
    try {
      await reactRideMessage(mensagem.id, emoji);
    } finally {
      confirmar();
    }
  }

  async function editar(mensagem: RideMessage, texto: string) {
    await mudarLista((lista) =>
      lista.map((outra) =>
        outra.id === mensagem.id
          ? { ...outra, body: texto.trim(), editedAt: new Date().toISOString() }
          : outra
      )
    );
    try {
      await editRideMessage(mensagem.id, texto);
    } finally {
      confirmar();
    }
  }

  async function apagar(mensagemId: string) {
    await mudarLista((lista) => lista.filter((outra) => outra.id !== mensagemId));
    try {
      await removeRideMessage(mensagemId);
    } finally {
      confirmar();
    }
  }

  return { enviar, reagir, editar, apagar };
}
