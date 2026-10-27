import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View, Pressable } from 'react-native';

import { useAbrirPerfil } from '@/hooks/use-abrir-perfil';
import { Spacing } from '@/constants/theme';
import {
  acceptFriendRequest,
  FriendRefused,
  removeFriend,
  type EstadoAmizade,
  type Friend,
  type FriendRequest,
} from '@/features/friends/api';
import {
  friendRequestsKey,
  friendsKey,
  friendStatesKey,
  useMyFriendRequests,
  useMyFriends,
  useRefreshFriends,
} from '@/features/friends/hooks/useFriends';
import { BotaoMais, useModeracao } from '@/features/moderation/components/Moderacao';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { vibrarErro, vibrarSucesso } from '@/lib/vibrar';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';
import { MensagemErro } from '@/ui/mensagem-erro';

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof FriendRefused)) return 'Não deu para fazer isso. Tenta outra vez.';
  switch (erro.reason) {
    case 'never_met':
      return 'Só podes pedir amizade a quem já foi contigo a um jogo.';
    case 'not_yours':
      return 'Esse pedido já não existe.';
    case 'rate_limited':
      return 'Já mandaste muitos pedidos hoje. Continua amanhã.';
    default:
      return 'Não deu para fazer isso. Tenta outra vez.';
  }
}

/** "3 viagens juntos" — o que a app sabe mesmo de uma amizade. */
function sinais(amigo: Pick<Friend, 'tripsTogether'>) {
  return amigo.tripsTogether > 0
    ? plural(amigo.tripsTogether, 'viagem juntos', 'viagens juntos')
    : 'ainda sem viagens juntos';
}

/**
 * Os amigos: gente com quem já foste a um jogo e com quem queres voltar a ir.
 *
 * Um pedido só vale quando o outro aceita, e só se pede a quem já se cruzou contigo — no mesmo grupo, no mesmo carro
 * ou nas mesmas contas. Não há aqui uma lista de pessoas para procurar: quem não foi a lado nenhum contigo não
 * aparece, de propósito.
 */
export default function AmigosScreen() {
  const abrirPerfil = useAbrirPerfil();
  const router = useRouter();
  const userId = useUserId();
  const refrescar = useRefreshFriends();
  const amigos = useMyFriends(userId !== null);
  const pedidos = useMyFriendRequests(userId !== null);
  const moderacao = useModeracao();
  const queryClient = useQueryClient();

  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Precisas de conta"
          message="Os amigos ficam guardados na tua conta."
          action={{ label: 'Entrar', onPress: () => router.push('/conta/entrar') }}
        />
      </Screen>
    );
  }

  async function tratar(acao: () => Promise<void>) {
    setErro(null);
    setATratar(true);
    try {
      await acao();
      void refrescar();
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
      vibrarErro();
    } finally {
      setATratar(false);
    }
  }

  /**
   * Accepting is optimistic: the request leaves the list, the person joins the friends and every cached friendship
   * state says "amigos" right away; all of it goes back if the server refuses.
   */
  async function aceitar(pedido: FriendRequest) {
    const filtros: { queryKey: QueryKey }[] = [
      { queryKey: friendStatesKey([]).slice(0, 2) },
      { queryKey: friendRequestsKey() },
      { queryKey: friendsKey() },
    ];
    await Promise.all(filtros.map((filtro) => queryClient.cancelQueries(filtro)));
    const anteriores = filtros.flatMap((filtro) => queryClient.getQueriesData(filtro));
    queryClient.setQueriesData<Record<string, EstadoAmizade>>(filtros[0], (estados) =>
      estados && pedido.profileId in estados ? { ...estados, [pedido.profileId]: 'amigos' } : estados
    );
    queryClient.setQueryData<FriendRequest[]>(friendRequestsKey(), (atuais) =>
      atuais?.filter((outro) => outro.profileId !== pedido.profileId)
    );
    queryClient.setQueryData<Friend[]>(friendsKey(), (atuais) =>
      atuais && !atuais.some((amigo) => amigo.profileId === pedido.profileId)
        ? [
            ...atuais,
            {
              profileId: pedido.profileId,
              displayName: pedido.displayName,
              friendsSince: new Date().toISOString(),
              tripsTogether: pedido.tripsTogether,
            },
          ]
        : atuais
    );
    try {
      await acceptFriendRequest(pedido.profileId);
      vibrarSucesso();
    } catch (problema) {
      for (const [chave, dados] of anteriores) queryClient.setQueryData(chave, dados);
      throw problema;
    }
  }

  const lista = amigos.data ?? [];
  const recebidos = (pedidos.data ?? []).filter((pedido) => pedido.direction === 'recebido');
  const enviados = (pedidos.data ?? []).filter((pedido) => pedido.direction === 'enviado');

  const desfazer = (profileId: string, nome: string) =>
    Alert.alert(
      'Deixar de ser amigo?',
      `Deixas de poder convidar ${nome} direto para as viagens.`,
      [
        { text: 'Deixa estar', style: 'cancel' },
        {
          text: 'Deixar',
          style: 'destructive',
          onPress: () => void tratar(() => removeFriend(profileId)),
        },
      ]
    );

  return (
    <Screen>
      {recebidos.length > 0 ? (
        <>
          <SectionHeader title="Pedidos de amizade" contagem={recebidos.length} />
          {recebidos.map((pedido) => (
            <Card key={pedido.profileId} style={styles.cartao}>
              <View style={styles.linha}>
                <Pressable
                  style={styles.flex}
                  onPress={() => abrirPerfil(pedido.profileId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver o perfil de ${pedido.displayName}, ${sinais(pedido)}`}>
                  <ThemedText style={styles.nome} numberOfLines={1}>
                    {pedido.displayName}
                  </ThemedText>
                </Pressable>
                <BotaoMais
                  nome={pedido.displayName}
                  onPress={() =>
                    moderacao.abrirPessoa({
                      pessoa: { profileId: pedido.profileId, nome: pedido.displayName },
                    })
                  }
                />
              </View>
              <Button
                label="Aceitar"
                icon={icons.selecionado}
                disabled={aTratar}
                onPress={() => void tratar(() => aceitar(pedido))}
              />
              <LinkTexto
                neutro
                label="Agora não"
                onPress={() => void tratar(() => removeFriend(pedido.profileId))}
              />
            </Card>
          ))}
        </>
      ) : null}

      <SectionHeader title="Amigos" contagem={lista.length} />
      {lista.length === 0 ? (
        <Card style={styles.cartao}>
          <ThemedText themeColor="textSecondary">
            Ainda não tens amigos na app. Depois de uma viagem, o resumo do jogo mostra quem foi
            contigo: é aí que se adiciona.
          </ThemedText>
          <LinkTexto label="Os meus jogos" onPress={() => router.push('/perfil/os-meus-jogos')} />
        </Card>
      ) : (
        lista.map((amigo) => (
          <Card key={amigo.profileId} style={styles.cartao}>
            <View style={styles.linha}>
              <Pressable
                style={styles.flex}
                onPress={() => abrirPerfil(amigo.profileId)}
                accessibilityRole="button"
                accessibilityLabel={`Ver o perfil de ${amigo.displayName}, ${sinais(amigo)}`}>
                <ThemedText style={styles.nome} numberOfLines={1}>
                  {amigo.displayName}
                </ThemedText>
              </Pressable>
              <Etiqueta icon={icons.perfil} label="Amigo" tone="positivo" />
              {/* Unfriend, report and block sit behind one discreet «⋯». */}
              <BotaoMais
                nome={amigo.displayName}
                onPress={() =>
                  moderacao.abrirPessoa({
                    pessoa: { profileId: amigo.profileId, nome: amigo.displayName },
                    extras: [
                      {
                        label: 'Deixar de ser amigo',
                        destrutiva: true,
                        onPress: () => desfazer(amigo.profileId, amigo.displayName),
                      },
                    ],
                  })
                }
              />
            </View>
          </Card>
        ))
      )}

      {enviados.length > 0 ? (
        <>
          <SectionHeader title="Pedidos por responder" contagem={enviados.length} />
          {enviados.map((pedido) => (
            <Card key={pedido.profileId} style={styles.cartao}>
              <View style={styles.linha}>
                <Pressable
                  style={styles.flex}
                  onPress={() => abrirPerfil(pedido.profileId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver o perfil de ${pedido.displayName}, ${sinais(pedido)}`}>
                  <ThemedText style={styles.nome} numberOfLines={1}>
                    {pedido.displayName}
                  </ThemedText>
                </Pressable>
                <Etiqueta icon={icons.horario} label="Enviado" tone="neutro" />
                {/* Like a friend's row: taking the request back sits behind the same discreet «⋯». */}
                <BotaoMais
                  nome={pedido.displayName}
                  onPress={() =>
                    moderacao.abrirPessoa({
                      pessoa: { profileId: pedido.profileId, nome: pedido.displayName },
                      extras: [
                        {
                          label: 'Desistir do pedido',
                          destrutiva: true,
                          onPress: () => void tratar(() => removeFriend(pedido.profileId)),
                        },
                      ],
                    })
                  }
                />
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {erro ? <MensagemErro>{erro}</MensagemErro> : null}
      {moderacao.elemento}

      <ThemedText type="small" themeColor="textMuted">
        Ser amigo serve para três coisas: convidar direto para uma boleia ou para um grupo, ver as
        viagens que já fizeram juntos, e as boleias de amigos aparecerem primeiro na lista.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.two,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  nome: {
    fontWeight: '600',
  },
});
