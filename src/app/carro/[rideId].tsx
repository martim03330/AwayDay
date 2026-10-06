import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useModeracao } from '@/features/moderation/components/Moderacao';
import { useProfileCards } from '@/features/profile/hooks/useMyProfile';
import {
  ChatRefused,
  markRideMessagesRead,
  removeRideMessage,
  sendRideMessage,
  type RideMessage,
} from '@/features/rides/chat';
import { useRideBoard } from '@/features/rides/hooks/useRides';
import { useRefreshRideChat, useRideMessages } from '@/features/rides/hooks/useRideChat';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { chaveDoDia, formatarDia } from '@/lib/datas';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { BolhaDeConversa, CaixaDeEscrita, PastilhaDeConversa } from '@/ui/conversa';
import { EmptyState } from '@/ui/empty-state';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof ChatRefused)) return 'Não deu para enviar. Tenta outra vez.';
  switch (erro.reason) {
    case 'not_in_ride':
      return 'Já não vais nesta boleia.';
    case 'chat_closed':
      return 'Esta conversa já fechou — o jogo foi há mais de um dia.';
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
  const cartoes = useProfileCards([
    ...new Set((mensagens.data ?? []).map((mensagem) => mensagem.profileId)),
  ]);
  const refrescar = useRefreshRideChat();
  const moderacao = useModeracao();
  const agora = useNow(60 * 1000);

  const [texto, setTexto] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
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
  const fotoDe = (profileId: string) =>
    (cartoes.data ?? []).find((cartao) => cartao.profileId === profileId)?.avatarUrl;

  async function enviar() {
    if (!rideId || texto.trim().length === 0) return;
    setErro(null);
    setAEnviar(true);
    try {
      await sendRideMessage(rideId, texto);
      setTexto('');
      await mensagens.refetch();
      void refrescar();
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    } finally {
      setAEnviar(false);
    }
  }

  const apagar = (id: string) =>
    Alert.alert('Apagar a mensagem?', 'Desaparece para toda a gente do carro.', [
      { text: 'Deixa estar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () =>
          void removeRideMessage(id)
            .then(() => mensagens.refetch())
            .then(() => refrescar())
            .catch((problema: unknown) => setErro(mensagemDeRecusa(problema))),
      },
    ]);

  // Long-press: your own message can be deleted; someone else's can be reported, or its author blocked (the driver
  // can still delete it too).
  const aoCarregarSemLargar = (mensagem: RideMessage) => {
    if (mensagem.mine) return mensagem.canRemove ? () => apagar(mensagem.id) : undefined;
    return () =>
      moderacao.abrirMensagem({
        kind: 'ride_message',
        messageId: mensagem.id,
        pessoa: { profileId: mensagem.profileId, nome: mensagem.displayName },
        extras: mensagem.canRemove
          ? [{ label: 'Apagar', destrutiva: true, onPress: () => apagar(mensagem.id) }]
          : [],
      });
  };

  return (
    <View style={[styles.tudo, { backgroundColor: theme.background }]}>
      {moderacao.elemento}
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
          <FlatList
            data={lista}
            inverted
            keyExtractor={(mensagem) => mensagem.id}
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
                    onLongPress={aoCarregarSemLargar(item)}
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
              aEnviar={aEnviar}
              placeholder="Escreve ao carro…"
              accessibilityLabel="Escrever ao carro"
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
