import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { fetchMyRideAlerts, type RideAlert } from '@/features/rides/api';
import { formatarDiaEHora, formatarHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { Card } from '@/ui/card';
import { IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';

function nomeDoJogo(fixtureId: string) {
  const jogo = obterJogo(fixtureId);
  if (!jogo) return 'o jogo';
  return `${obterClube(jogo.casaId)?.nomeCurto ?? ''} x ${obterClube(jogo.foraId)?.nomeCurto ?? ''}`;
}

function conteudo(alerta: RideAlert) {
  const jogo = nomeDoJogo(alerta.fixtureId);
  switch (alerta.kind) {
    case 'pedidos':
      return {
        tom: 'yellow' as const,
        icon: icons.perfil,
        titulo: `${plural(alerta.pending, 'pedido', 'pedidos')} de lugar por responder`,
        texto: `Boleia para ${jogo} · responde até às ${formatarHora(new Date(alerta.requestsCloseAt))}`,
      };
    case 'aceite':
      return {
        tom: 'green' as const,
        icon: icons.carro,
        titulo: `Tens lugar na boleia de ${alerta.driverName ?? 'um adepto'}`,
        texto: `${jogo} · sai ${formatarDiaEHora(new Date(alerta.departureAt)).toLowerCase()}`,
      };
    case 'recusado':
      return {
        tom: 'neutral' as const,
        icon: icons.fechar,
        titulo: 'O teu pedido de lugar foi recusado',
        texto: `${jogo} · vê se há outra boleia com lugar`,
      };
    case 'sem_resposta':
      return {
        tom: 'neutral' as const,
        icon: icons.horario,
        titulo: 'O teu pedido ficou sem resposta',
        texto: `${jogo} · vê se há outra boleia com lugar`,
      };
    case 'cancelada':
      return {
        tom: 'red' as const,
        icon: icons.aviso,
        titulo: `${alerta.driverName ?? 'O condutor'} cancelou a boleia`,
        texto: `${jogo} · procura outra boleia`,
      };
    case 'volta_pedidos':
      return {
        tom: 'yellow' as const,
        icon: icons.carro,
        titulo: `${plural(alerta.pending, 'pedido', 'pedidos')} de boleia de volta`,
        texto: `${jogo} · alguém ficou sem transporte e está à espera de resposta`,
      };
    case 'volta_aceite':
      return {
        tom: 'green' as const,
        icon: icons.carro,
        titulo: `${alerta.driverName ?? 'Um adepto'} leva-te de volta`,
        texto: `${jogo} · combina onde se encontram`,
      };
    case 'volta_recusado':
      return {
        tom: 'neutral' as const,
        icon: icons.fechar,
        titulo: 'Sem boleia de volta neste carro',
        texto: `${jogo} · vê se há outro carro a voltar`,
      };
  }
}

/**
 * What needs attention about rides, at the top of the games list: requests to answer first (with the deadline), then
 * confirmed seats, declined or unanswered requests and cancelled rides. Tapping opens the ride. Refreshes every minute.
 */
export function AlertasBoleias() {
  const router = useRouter();
  const userId = useUserId();
  const alertas = useQuery({
    queryKey: ['rides', 'alerts', userId],
    queryFn: userId ? fetchMyRideAlerts : skipToken,
    refetchInterval: 60 * 1000,
    meta: { persist: false },
  });

  const lista = alertas.data ?? [];
  if (lista.length === 0) return null;

  return (
    <View style={styles.lista}>
      {lista.map((alerta) => {
        const { tom, icon, titulo, texto } = conteudo(alerta);
        return (
          <Card
            key={`${alerta.kind}-${alerta.rideId}`}
            onPress={() =>
              router.push(
                // The fan who asked for a seat home goes back to the list of cars going back, not to a ride they
                // may not be part of; everything else opens the ride itself.
                alerta.kind === 'volta_aceite' || alerta.kind === 'volta_recusado'
                  ? { pathname: '/jogos/boleia-de-volta', params: { jogoId: alerta.fixtureId } }
                  : {
                      pathname: '/jogos/boleia',
                      params: { rideId: alerta.rideId, jogoId: alerta.fixtureId },
                    }
              )
            }
            accessibilityLabel={`${titulo}. ${texto}. Toca para abrir a boleia.`}>
            <ListRow
              leading={<IconCircle name={icon} tone={tom} />}
              title={titulo}
              subtitle={texto}
            />
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: Spacing.two,
  },
});
