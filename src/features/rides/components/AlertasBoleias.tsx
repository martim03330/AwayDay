import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { fetchMyRideAlerts, type RideAlert } from '@/features/rides/api';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaCurto, formatarHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { Card } from '@/ui/card';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';

function nomeDoJogo(fixtureId: string) {
  const jogo = obterJogo(fixtureId);
  if (!jogo) return 'o jogo';
  return `${obterClube(jogo.casaId)?.nomeCurto ?? ''} x ${obterClube(jogo.foraId)?.nomeCurto ?? ''}`;
}

/** «Amanhã 15:00», «31/10 15:00»: when the car leaves, in as few characters as fit at the end of a row. */
function quandoSai(alerta: RideAlert) {
  const partida = new Date(alerta.departureAt);
  return `${formatarDiaCurto(partida)} ${formatarHora(partida)}`;
}

/**
 * The row's title, a short value for its right side (a time, never a sentence) and, for VoiceOver, the line that
 * used to sit under the title.
 */
function conteudo(alerta: RideAlert) {
  const jogo = nomeDoJogo(alerta.fixtureId);
  switch (alerta.kind) {
    case 'pedidos':
      return {
        tom: 'yellow' as const,
        icon: icons.perfil,
        titulo: `${plural(alerta.pending, 'pedido', 'pedidos')} de lugar por responder`,
        valor: `até ${formatarHora(new Date(alerta.requestsCloseAt))}`,
        detalhe: `Boleia para ${jogo} · responde até às ${formatarHora(new Date(alerta.requestsCloseAt))}`,
      };
    case 'aceite':
      return {
        tom: 'green' as const,
        icon: icons.carro,
        titulo: `Tens lugar na boleia de ${alerta.driverName ?? 'um adepto'}`,
        valor: quandoSai(alerta),
        detalhe: jogo,
      };
    case 'recusado':
      return {
        tom: 'neutral' as const,
        icon: icons.fechar,
        titulo: 'O teu pedido de lugar foi recusado',
        valor: undefined,
        detalhe: `${jogo} · vê se há outra boleia com lugar`,
      };
    case 'sem_resposta':
      return {
        tom: 'neutral' as const,
        icon: icons.horario,
        titulo: 'O teu pedido ficou sem resposta',
        valor: undefined,
        detalhe: `${jogo} · vê se há outra boleia com lugar`,
      };
    case 'cancelada':
      return {
        tom: 'red' as const,
        icon: icons.aviso,
        titulo: `${alerta.driverName ?? 'O condutor'} cancelou a boleia`,
        valor: undefined,
        detalhe: `${jogo} · procura outra boleia`,
      };
    case 'volta_pedidos':
      return {
        tom: 'yellow' as const,
        icon: icons.carro,
        titulo: `${plural(alerta.pending, 'pedido', 'pedidos')} de boleia de volta`,
        valor: undefined,
        detalhe: `${jogo} · alguém ficou sem transporte e está à espera de resposta`,
      };
    case 'volta_aceite':
      return {
        tom: 'green' as const,
        icon: icons.carro,
        titulo: `${alerta.driverName ?? 'Um adepto'} leva-te de volta`,
        valor: undefined,
        detalhe: `${jogo} · combina onde se encontram`,
      };
    case 'volta_recusado':
      return {
        tom: 'neutral' as const,
        icon: icons.fechar,
        titulo: 'Sem boleia de volta neste carro',
        valor: undefined,
        detalhe: `${jogo} · vê se há outro carro a voltar`,
      };
  }
}

/**
 * What needs attention about rides, at the top of the games list: requests to answer first (with the deadline), then
 * confirmed seats, declined or unanswered requests and cancelled rides. Tapping opens the ride. Refreshes every minute.
 */
export function AlertasBoleias({
  boleiasComSessao = [],
}: {
  /**
   * Boleias cuja sessão da viagem já abriu: aí o «tens lugar na boleia» vive dentro da sessão, e aqui só repetia.
   */
  boleiasComSessao?: string[];
}) {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const alertas = useQuery({
    queryKey: ['rides', 'alerts', userId],
    queryFn: userId ? fetchMyRideAlerts : skipToken,
    refetchInterval: 60 * 1000,
    meta: { persist: false },
  });

  const lista = (alertas.data ?? []).filter(
    (alerta) => !(alerta.kind === 'aceite' && boleiasComSessao.includes(alerta.rideId))
  );
  if (lista.length === 0) return null;

  return (
    <Card style={styles.cartao}>
      {lista.map((alerta, indice) => {
        const { tom, icon, titulo, valor, detalhe } = conteudo(alerta);
        return (
          <LinhaGrupo
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
            accessibilityLabel={`${titulo}${valor ? `, ${valor}` : ''}. ${detalhe}. Toca para abrir a boleia.`}
            leading={<IconCircle name={icon} tone={tom} />}
            title={titulo}
            valor={valor}
            trailing={<Icon name={icons.seguinte} size={18} color={theme.textMuted} />}
            separador={indice < lista.length - 1}
          />
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  // One card for every alert, a row each: a stack of cards read as a wall.
  cartao: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
});
