import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useProfileCards } from '@/features/profile/hooks/useMyProfile';
import { useRideBoard } from '@/features/rides/hooks/useRides';
import {
  ChatRefused,
  markRideMessagesRead,
  removeRideMessage,
  sendRideMessage,
} from '@/features/rides/chat';
import { useRefreshRideChat, useRideMessages } from '@/features/rides/hooks/useRideChat';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { Avatar } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
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
 * A conversa de um carro: o condutor e quem já foi aceite.
 *
 * Serve para o que não cabe na ficha da boleia — a que horas sai mesmo, onde é o ponto de encontro, se passa em
 * Mangualde. Toda a gente lê o mesmo, para o condutor não ter de repetir quatro vezes.
 */
export default function ConversaScreen() {
  const router = useRouter();
  const theme = useTheme();
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
  const agora = useNow(60 * 1000);

  const [texto, setTexto] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Abrir a conversa é lê-la: o aviso de mensagens novas desaparece daqui para a frente.
  const porLer = (mensagens.data ?? []).some((mensagem) => !mensagem.mine);
  useEffect(() => {
    if (!rideId || !souDoCarro || !porLer) return;
    void markRideMessagesRead(rideId)
      .then(() => refrescar())
      .catch(() => undefined);
  }, [rideId, souDoCarro, porLer, refrescar]);

  if (!userId || !rideId || !jogoId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.carro}
          title="Conversa não encontrada"
          message="Abre a conversa a partir da boleia."
          action={{ label: 'Voltar aos jogos', onPress: () => router.replace('/jogos') }}
        />
      </Screen>
    );
  }

  if (quadro.isLoading) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">A abrir a conversa…</ThemedText>
      </Screen>
    );
  }

  if (!souDoCarro) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="A conversa é de quem vai no carro"
          message="Assim que o condutor aceitar o teu lugar, entras aqui e podes combinar tudo com a malta."
          action={{
            label: 'Ver a boleia',
            onPress: () =>
              router.replace({ pathname: '/jogos/boleia', params: { rideId, jogoId } }),
          }}
        />
      </Screen>
    );
  }

  const lista = mensagens.data ?? [];
  // A conversa fecha à escrita um dia depois do jogo. A regra é a mesma no servidor, que é quem manda.
  const fechada = jogo ? agora > Date.parse(jogo.inicio) + 24 * 60 * 60 * 1000 : false;

  async function enviar() {
    if (!rideId) return;
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

  return (
    <KeyboardAvoidingView
      style={styles.tudo}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <ThemedText type="title">Conversa do carro</ThemedText>
        <ThemedText themeColor="textSecondary">
          {[
            boleia?.isMine ? 'A tua boleia' : `Boleia de ${boleia?.driverName ?? 'um adepto'}`,
            jogo
              ? `${obterClube(jogo.casaId)?.nomeCurto ?? ''} x ${obterClube(jogo.foraId)?.nomeCurto ?? ''}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </ThemedText>

        {lista.length === 0 ? (
          <Card>
            <ThemedText themeColor="textSecondary">
              Ainda ninguém escreveu. É aqui que se combina a hora certa, o sítio de encontro e a
              volta.
            </ThemedText>
          </Card>
        ) : (
          lista.map((mensagem) => (
            <Card key={mensagem.id} style={styles.mensagem}>
              <View style={styles.linha}>
                <Avatar
                  nome={mensagem.displayName}
                  url={
                    (cartoes.data ?? []).find((cartao) => cartao.profileId === mensagem.profileId)
                      ?.avatarUrl
                  }
                  size={32}
                />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">
                    {mensagem.mine ? 'Tu' : mensagem.displayName}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textMuted">
                    {formatarDiaEHora(new Date(mensagem.createdAt))}
                  </ThemedText>
                </View>
              </View>
              <ThemedText>{mensagem.body}</ThemedText>
              {mensagem.canRemove ? (
                <LinkTexto label="Apagar" onPress={() => apagar(mensagem.id)} />
              ) : null}
            </Card>
          ))
        )}

        {fechada ? (
          <Card>
            <ThemedText themeColor="textSecondary">
              Esta conversa já fechou: passou mais de um dia sobre o jogo. Fica aqui para consulta.
            </ThemedText>
          </Card>
        ) : (
          <Card style={styles.mensagem}>
            <Campo
              label="Escrever ao carro"
              value={texto}
              onChangeText={setTexto}
              placeholder="Saio às 15:00 do Rossio"
              maxLength={500}
            />
            <Button
              label={aEnviar ? 'A enviar…' : 'Enviar'}
              icon={icons.partilhar}
              disabled={aEnviar || texto.trim().length === 0}
              onPress={() => void enviar()}
            />
          </Card>
        )}

        {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}

        <ThemedText type="small" themeColor="textMuted">
          Escrevem aqui o condutor e quem já tem lugar. Cada um apaga o que escreveu; o condutor
          pode apagar o que for do carro dele.
        </ThemedText>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tudo: {
    flex: 1,
  },
  mensagem: {
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
});
