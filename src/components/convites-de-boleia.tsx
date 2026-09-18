import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { acceptRideInvite, declineRideInvite, FriendRefused } from '@/features/friends/api';
import { useMyRideInvites, useRefreshFriends } from '@/features/friends/hooks/useFriends';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

function nomeDoJogo(fixtureId: string) {
  const jogo = obterJogo(fixtureId);
  if (!jogo) return 'um jogo';
  return `${obterClube(jogo.casaId)?.nomeCurto ?? ''} x ${obterClube(jogo.foraId)?.nomeCurto ?? ''}`;
}

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof FriendRefused)) return 'Não deu para responder. Tenta outra vez.';
  if (erro.reason === 'ride_full') return 'O carro encheu entretanto.';
  if (erro.reason === 'ride_closed') return 'Essa boleia já não está de pé.';
  return 'Não deu para responder. Tenta outra vez.';
}

/**
 * Convites para entrar no carro de um amigo. Ao contrário de um pedido de lugar, aqui o lugar já é teu: é só
 * aceitar. Ficam no topo da lista de jogos, que é onde se abre a app.
 */
export function ConvitesDeBoleia() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const convites = useMyRideInvites(userId !== null);
  const refrescar = useRefreshFriends();
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!userId || (convites.data ?? []).length === 0) return null;

  async function responder(acao: () => Promise<void>) {
    setErro(null);
    setATratar(true);
    try {
      await acao();
      void refrescar();
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    } finally {
      setATratar(false);
    }
  }

  return (
    <>
      {(convites.data ?? []).map((convite) => (
        <Card key={convite.rideId} style={styles.cartao}>
          <Etiqueta icon={icons.carro} label="Convite para boleia" tone="destaque" />
          <ThemedText style={styles.nome}>
            {`${convite.driverName} tem lugar para ti · ${nomeDoJogo(convite.fixtureId)}`}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`Sai de ${convite.originName} ${formatarDiaEHora(
              new Date(convite.departureAt)
            ).toLowerCase()} · ${formatarCentimos(convite.shareCents)} para ti`}
          </ThemedText>
          <Button
            label="Aceitar o lugar"
            icon={icons.selecionado}
            disabled={aTratar}
            onPress={() =>
              void responder(() => acceptRideInvite(convite.rideId)).then(() =>
                router.push({
                  pathname: '/jogos/boleia',
                  params: { rideId: convite.rideId, jogoId: convite.fixtureId },
                })
              )
            }
          />
          <LinkTexto
            neutro
            label="Agora não"
            onPress={() => void responder(() => declineRideInvite(convite.rideId))}
          />
          {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.two,
  },
  nome: {
    fontWeight: '600',
  },
});
