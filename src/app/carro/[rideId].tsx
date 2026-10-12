import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View, type FlatList } from 'react-native';
import Animated, { Easing, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useModeracao } from '@/features/moderation/components/Moderacao';
import { useProfileCards } from '@/features/profile/hooks/useMyProfile';
import { ChatRefused, markRideMessagesRead, type RideMessage } from '@/features/rides/chat';
import { useRideBoard, useRidePeople } from '@/features/rides/hooks/useRides';
import {
  useRefreshRideChat,
  useRideChannel,
  useRideChatActions,
  useRideMessages,
} from '@/features/rides/hooks/useRideChat';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { aindaDaParaEditar, chaveDaMensagem, eLocal, minhaReacao, proximaReacao, type Emoji } from '@/lib/conversa';
import { chaveDoDia, formatarDia, formatarHora } from '@/lib/datas';
import { mencoesNoTexto, type Mencionavel } from '@/lib/mencoes';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { BolhaDeConversa, CaixaDeEscrita, PastilhaDeConversa, type PosicaoNoEcra } from '@/ui/conversa';
import { EmptyState } from '@/ui/empty-state';
import { Icon, icons } from '@/ui/icon';
import { MenuDaMensagem, type AcaoDaMensagem } from '@/ui/menu-da-mensagem';
import { ThemedText } from '@/ui/themed-text';

/** How the rest of the chat makes room for a new message: as fast as the send animation, easing out. */
const DESLIZAR_MENSAGENS = LinearTransition.duration(240).easing(Easing.out(Easing.cubic));

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof ChatRefused)) return 'Não deu para enviar. Tenta outra vez.';
  switch (erro.reason) {
    case 'not_in_ride':
      return 'Já não vais nesta boleia.';
    case 'chat_closed':
      return 'Esta conversa já fechou: o jogo foi há mais de um dia.';
    case 'bad_message':
      return 'Escreve alguma coisa (até 500 letras).';
    case 'rate_limited':
      return 'Escreveste muitas mensagens hoje. Continua amanhã.';
    default:
      return 'Não deu para enviar. Tenta outra vez.';
  }
}

/**
 * A conversa de um carro: o condutor e quem já tem lugar. Igual à conversa do grupo — bolhas, a caixa em baixo —
 * para combinar a hora certa, o ponto de encontro e a volta sem o condutor repetir tudo quatro vezes.
 */
export default function ConversaDoCarroScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const alturaDoCabecalho = useHeaderHeight();
  const userId = useUserId();
  const { rideId, jogoId } = useLocalSearchParams<{ rideId?: string; jogoId?: string }>();
  const jogo = jogoId ? obterJogo(jogoId) : undefined;

  const quadro = useRideBoard(jogoId ?? null, userId !== null);
  const boleia = (quadro.data ?? []).find((candidata) => candidata.id === rideId);
  const souDoCarro = boleia?.isMine === true || boleia?.myStatus === 'accepted';
  const mensagens = useRideMessages(rideId ?? null, souDoCarro);
  useRideChannel(rideId ?? null, souDoCarro);
  const pessoasDoCarro = useRidePeople(rideId ?? null, souDoCarro);
  const acoes = useRideChatActions(rideId ?? null, userId ? { profileId: userId, nome: 'Tu' } : null);
  const cartoes = useProfileCards([
    ...new Set((mensagens.data ?? []).map((mensagem) => mensagem.profileId)),
  ]);
  const refrescar = useRefreshRideChat();
  const listaRef = useRef<FlatList<NonNullable<typeof mensagens.data>[number]>>(null);
  const [destaque, setDestaque] = useState<string | null>(null);
  const moderacao = useModeracao();
  const agora = useNow(60 * 1000);

  const [texto, setTexto] = useState('');
  const [aResponder, setAResponder] = useState<RideMessage | null>(null);
  const [aEditar, setAEditar] = useState<RideMessage | null>(null);
  const [menuDe, setMenuDe] = useState<{ mensagem: RideMessage; podeEditar: boolean; posicao: PosicaoNoEcra | null; comNome: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Abrir a conversa é lê-la.
  const ultimaDeOutro = (mensagens.data ?? []).filter((m) => !m.mine).at(-1)?.id ?? null;
  useEffect(() => {
    if (!rideId || !souDoCarro || !ultimaDeOutro) return;
    void markRideMessagesRead(rideId)
      .then(() => refrescar())
      .catch(() => undefined);
  }, [rideId, souDoCarro, ultimaDeOutro, refrescar]);

  const nomeDoJogo = jogo
    ? `${obterClube(jogo.casaId)?.nomeCurto ?? ''} x ${obterClube(jogo.foraId)?.nomeCurto ?? ''}`
    : null;

  if (!userId || !rideId || !jogoId || (!quadro.isLoading && !souDoCarro)) {
    return (
      <View style={[styles.tudo, { backgroundColor: theme.background }]}>
        <EmptyState
          icon={icons.conversa}
          title="A conversa é de quem vai no carro"
          message="Assim que tiveres lugar, entras aqui e combinas tudo com a malta."
          action={{ label: 'Voltar', onPress: () => router.back() }}
        />
      </View>
    );
  }

  // A conversa fecha à escrita um dia depois do jogo (a regra é do servidor).
  const fechada = jogo ? agora > Date.parse(jogo.inicio) + 24 * 60 * 60 * 1000 : false;
  // A mais recente primeiro: a lista está invertida.
  const lista = [...(mensagens.data ?? [])].reverse();
  // Tapping the quote of a reply: the chat goes to the original message and it flashes (as in WhatsApp).
  const irParaMensagem = (id: string) => {
    const indice = lista.findIndex((mensagem) => mensagem.id === id);
    if (indice < 0) return;
    listaRef.current?.scrollToIndex({ index: indice, animated: true, viewPosition: 0.5 });
    setDestaque(id);
    setTimeout(() => setDestaque((atual) => (atual === id ? null : atual)), 1500);
  };
  const fotoDe = (profileId: string) =>
    (cartoes.data ?? []).find((cartao) => cartao.profileId === profileId)?.avatarUrl;
  // The car: the driver and whoever has a seat. Everyone but you can be mentioned.
  const noCarro = (pessoasDoCarro.data ?? []).filter(
    (pessoa) => pessoa.status === 'driver' || pessoa.status === 'accepted'
  );
  const mencionaveis: Mencionavel[] = noCarro
    .filter((pessoa) => pessoa.profileId !== userId)
    .map((pessoa) => ({ profileId: pessoa.profileId, nome: pessoa.name, fotoUrl: fotoDe(pessoa.profileId) }));
  const nomesDoCarro = noCarro.map((pessoa) => pessoa.name);

  // Shows at once (see useRideChatActions). If the server refuses, the text and the reply come back to the box.
  async function enviar() {
    if (!rideId || texto.trim().length === 0) return;
    const escrito = texto;
    const resposta = aResponder;
    const edicao = aEditar;
    setErro(null);
    setTexto('');
    setAResponder(null);
    setAEditar(null);
    try {
      if (edicao) await acoes.editar(edicao, escrito);
      else await acoes.enviar(escrito, resposta, mencoesNoTexto(escrito, mencionaveis));
    } catch (problema) {
      setTexto(escrito);
      setAResponder(resposta);
      setAEditar(edicao);
      setErro(mensagemDeRecusa(problema));
    }
  }

  const apagar = (id: string) =>
    Alert.alert('Apagar a mensagem?', 'Desaparece para toda a gente do carro.', [
      { text: 'Deixa estar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () =>
          void acoes.apagar(id).catch((problema: unknown) => setErro(mensagemDeRecusa(problema))),
      },
    ]);

  function reagir(mensagem: RideMessage, emoji: Emoji) {
    void acoes
      .reagir(mensagem, proximaReacao(mensagem.reactions, emoji))
      .catch(() => setErro('Não deu para reagir. Tenta outra vez.'));
  }

  function responder(mensagem: RideMessage) {
    setAEditar(null);
    setAResponder(mensagem);
  }

  function editar(mensagem: RideMessage) {
    setAResponder(null);
    setAEditar(mensagem);
    setTexto(mensagem.body);
  }

  function cancelarContexto() {
    if (aEditar) setTexto('');
    setAEditar(null);
    setAResponder(null);
  }

  const abrirPessoa = (profileId: string) =>
    router.push({ pathname: '/pessoa/[pessoaId]', params: { pessoaId: profileId } });

  // Long-press: react, reply, edit (yours, for 15 minutes), delete (yours, or any if you drive), or report.
  function acoesDoMenu(mensagem: RideMessage, podeEditar: boolean): AcaoDaMensagem[] {
    const acoes: AcaoDaMensagem[] = fechada
      ? []
      : [{ label: 'Responder', icon: icons.responder, onPress: () => responder(mensagem) }];
    if (podeEditar && !fechada) {
      acoes.push({ label: 'Editar', icon: icons.editar, onPress: () => editar(mensagem) });
    }
    if (!mensagem.mine) {
      acoes.push({ label: 'Ver perfil', icon: icons.perfil, onPress: () => abrirPessoa(mensagem.profileId) });
    }
    if (mensagem.canRemove) {
      acoes.push({ label: 'Apagar', icon: icons.apagar, perigo: true, onPress: () => apagar(mensagem.id) });
    }
    if (!mensagem.mine) {
      acoes.push({
        label: 'Denunciar ou bloquear',
        icon: icons.aviso,
        perigo: true,
        onPress: () =>
          moderacao.abrirMensagem({
            kind: 'ride_message',
            messageId: mensagem.id,
            pessoa: { profileId: mensagem.profileId, nome: mensagem.displayName },
          }),
      });
    }
    return acoes;
  }

  return (
    <View style={[styles.tudo, { backgroundColor: theme.background }]}>
      {moderacao.elemento}
      <MenuDaMensagem
        texto={menuDe?.mensagem.body ?? null}
        minha={menuDe?.mensagem.mine ?? false}
        posicao={menuDe?.posicao ?? null}
        hora={
          menuDe
            ? `${menuDe.mensagem.editedAt !== null ? 'editada · ' : ''}${formatarHora(new Date(menuDe.mensagem.createdAt))}`
            : undefined
        }
        nome={menuDe?.comNome ? menuDe.mensagem.displayName : null}
        citacao={menuDe?.mensagem.replyTo ?? null}
        minhaReacao={menuDe ? minhaReacao(menuDe.mensagem.reactions) : null}
        onReagir={menuDe ? (emoji) => reagir(menuDe.mensagem, emoji) : undefined}
        acoes={menuDe ? acoesDoMenu(menuDe.mensagem, menuDe.podeEditar) : []}
        onFechar={() => setMenuDe(null)}
      />
      <Stack.Screen
        options={{
          title: 'Conversa do carro',
          headerTitle: () => (
            <View style={styles.titulo}>
              <View style={[styles.azulejo, { backgroundColor: theme.accent }]}>
                <Icon name={icons.carro} size={18} color={theme.accentText} />
              </View>
              <View style={styles.tituloTexto}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {boleia?.isMine ? 'O teu carro' : `Carro de ${boleia?.driverName ?? '…'}`}
                </ThemedText>
                {nomeDoJogo ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {nomeDoJogo}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.tudo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={alturaDoCabecalho}>
        {lista.length === 0 ? (
          <View style={[styles.tudo, styles.centro]}>
            {mensagens.isLoading ? null : (
              <View style={[styles.vazio, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">Ainda ninguém escreveu</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Combinem aqui a hora certa, o sítio de encontro e a volta.
                </ThemedText>
              </View>
            )}
          </View>
        ) : (
          <Animated.FlatList
            ref={listaRef}
            // A message far up (not measured yet): go near it first, then to it.
            onScrollToIndexFailed={(falhou) => {
              listaRef.current?.scrollToOffset({ offset: falhou.averageItemLength * falhou.index, animated: true });
              setTimeout(
                () => listaRef.current?.scrollToIndex({ index: falhou.index, animated: true, viewPosition: 0.5 }),
                250
              );
            }}
            // The other messages slide up with the new one instead of jumping in one frame.
            itemLayoutAnimation={DESLIZAR_MENSAGENS}
            data={lista}
            inverted
            keyExtractor={chaveDaMensagem}
            contentContainerStyle={styles.mensagens}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            renderItem={({ item, index }) => {
              const anterior = lista[index + 1];
              const novoDia =
                !anterior ||
                chaveDoDia(new Date(anterior.createdAt)) !== chaveDoDia(new Date(item.createdAt));
              return (
                <View>
                  {novoDia ? (
                    <PastilhaDeConversa texto={formatarDia(new Date(item.createdAt))} />
                  ) : null}
                  <BolhaDeConversa
                    nome={item.displayName}
                    texto={item.body}
                    criadaEm={item.createdAt}
                    minha={item.mine}
                    mostrarQuem={novoDia || anterior?.profileId !== item.profileId}
                    fotoUrl={fotoDe(item.profileId)}
                    citacao={item.replyTo}
                    onAbrirCitacao={item.replyTo ? () => item.replyTo && irParaMensagem(item.replyTo.id) : undefined}
                    destacada={destaque === item.id}
                    editada={item.editedAt !== null}
                    reacoes={item.reactions}
                    pendente={eLocal(item.id)}
                    animarEntrada={item.chaveLocal !== undefined}
                    nomesMencionaveis={nomesDoCarro}
                    mencionaMe={item.mentionsMe}
                    onReagir={eLocal(item.id) ? undefined : (emoji) => reagir(item, emoji)}
                    onResponder={fechada || eLocal(item.id) ? undefined : () => responder(item)}
                    onAbrirPessoa={() => abrirPessoa(item.profileId)}
                    onLongPress={
                      eLocal(item.id)
                        ? undefined
                        : (posicao) =>
                            setMenuDe({
                              mensagem: item,
                              podeEditar: item.mine && aindaDaParaEditar(item.createdAt, Date.now()),
                              posicao,
                              comNome: !item.mine && (novoDia || anterior?.profileId !== item.profileId),
                            })
                    }
                  />
                </View>
              );
            }}
          />
        )}

        <View
          style={[
            styles.rodape,
            {
              backgroundColor: theme.backgroundElement,
              borderTopColor: theme.border,
              paddingBottom: Math.max(insets.bottom, Spacing.two),
            },
          ]}>
          {erro ? (
            <ThemedText type="small" style={{ color: theme.dangerText }}>
              {erro}
            </ThemedText>
          ) : null}
          {fechada ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centroTexto}>
              Esta conversa já fechou: passou mais de um dia sobre o jogo.
            </ThemedText>
          ) : (
            <CaixaDeEscrita
              valor={texto}
              onChange={setTexto}
              onEnviar={() => void enviar()}
              aEnviar={false}
              placeholder="Escreve ao carro…"
              accessibilityLabel="Escrever ao carro"
              mencionaveis={mencionaveis}
              contexto={
                aEditar
                  ? { titulo: 'A editar a mensagem', texto: aEditar.body, onCancelar: cancelarContexto }
                  : aResponder
                    ? {
                        titulo: `A responder a ${aResponder.mine ? 'ti' : aResponder.displayName}`,
                        texto: aResponder.body,
                        onCancelar: cancelarContexto,
                      }
                    : null
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  tudo: {
    flex: 1,
  },
  centro: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centroTexto: {
    textAlign: 'center',
  },
  titulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: 260,
  },
  tituloTexto: {
    flexShrink: 1,
  },
  azulejo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mensagens: {
    padding: Spacing.three,
    gap: Spacing.one,
    flexGrow: 1,
  },
  vazio: {
    alignSelf: 'center',
    maxWidth: 300,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    gap: Spacing.one,
  },
  rodape: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
});
