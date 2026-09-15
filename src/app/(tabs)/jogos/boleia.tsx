import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import {
  answerRequest,
  cancelRide,
  leaveRide,
  requestSeat,
  RideRefused,
  type RideSummary,
} from '@/features/rides/api';
import { useRefreshRides, useRideBoard, useRidePeople } from '@/features/rides/hooks/useRides';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { abrirDirecoes } from '@/lib/direcoes';
import { formatarDistancia, plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { obterJogo } from '@/mocks/jogos';
import { obterEstadio } from '@/mocks/estadios';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

const OPCOES: Record<RideSummary['routeOption'], string> = {
  rapida: 'Mais rápido',
  equilibrio: 'Equilíbrio',
  sem_portagens: 'Sem portagens',
};

function duracao(segundos: number) {
  const minutos = Math.round(segundos / 60);
  const horas = Math.floor(minutos / 60);
  return horas > 0 ? `${horas} h ${String(minutos % 60).padStart(2, '0')}` : `${minutos} min`;
}

function mensagemRecusa(erro: unknown) {
  if (!(erro instanceof RideRefused)) return 'Verifica a ligação e tenta outra vez.';
  switch (erro.reason) {
    case 'ride_full':
      return 'A boleia já está cheia.';
    case 'ride_closed':
      return 'Esta boleia já não aceita pedidos.';
    case 'rate_limited':
      return 'Fizeste muitos pedidos hoje. Tenta amanhã.';
    case 'own_ride':
      return 'Esta boleia é tua.';
    default:
      return 'Não deu para concluir. Tenta outra vez.';
  }
}

function LinhaValor({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <View style={styles.linhaValor}>
      <ThemedText
        themeColor={destaque ? undefined : 'textSecondary'}
        style={destaque ? styles.destaque : undefined}>
        {rotulo}
      </ThemedText>
      <ThemedText style={[styles.valor, destaque && styles.destaque]}>{valor}</ThemedText>
    </View>
  );
}

/** One ride: route, cost, the price per person as it fills up, and asking for a seat or managing requests. */
export default function BoleiaScreen() {
  const router = useRouter();
  const theme = useTheme();
  const agora = useNow(60 * 1000);
  const userId = useUserId();
  const { rideId, jogoId } = useLocalSearchParams<{ rideId: string; jogoId: string }>();
  const jogo = jogoId ? obterJogo(jogoId) : undefined;
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;
  const quadro = useRideBoard(jogoId ?? null, userId !== null);
  const boleia = quadro.data?.find((candidata) => candidata.id === rideId);
  const podeVerPessoas = boleia ? boleia.isMine || boleia.myStatus === 'accepted' : false;
  const pessoas = useRidePeople(rideId ?? null, podeVerPessoas);
  const atualizar = useRefreshRides();
  const [aTratar, setATratar] = useState(false);

  async function executar(acao: () => Promise<void>) {
    setATratar(true);
    try {
      await acao();
      await atualizar();
    } catch (erro) {
      Alert.alert('Não foi possível', mensagemRecusa(erro));
    } finally {
      setATratar(false);
    }
  }

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Precisas de conta"
          message="As boleias ligam pessoas reais: entra para ver os lugares e pedir o teu."
          action={{ label: 'Entrar', onPress: () => router.push('/conta/entrar') }}
        />
      </Screen>
    );
  }

  if (quadro.isLoading) {
    return (
      <Screen>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
      </Screen>
    );
  }

  if (!boleia || !jogo) {
    return (
      <Screen>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Boleia não encontrada"
          message="Pode ter sido cancelada. Volta ao teu jogo e vê as outras."
          action={{ label: 'Voltar', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const livres = boleia.seatsOffered - boleia.seatsTaken;
  const pedidos = (pessoas.data ?? []).filter((pessoa) => pessoa.status === 'requested');
  const noCarro = (pessoas.data ?? []).filter((pessoa) => pessoa.status !== 'requested');
  const cancelada = boleia.status === 'cancelled';

  return (
    <Screen>
      <Card style={styles.grupo}>
        <ThemedText type="eyebrow" themeColor="accentInk">
          {`${OPCOES[boleia.routeOption]} · ${boleia.roundTrip ? 'ida e volta' : 'só ida'}`}
        </ThemedText>
        <ThemedText type="title" style={styles.titulo}>
          {boleia.originName}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {`${boleia.isMine ? 'A tua boleia' : `Com ${boleia.driverName}`} · sai ${formatarDiaEHora(new Date(boleia.departureAt), agora).toLowerCase()}${estadio ? ` para o ${estadio.nome}` : ''}`}
        </ThemedText>
        <View style={styles.etiquetas}>
          {cancelada ? (
            <Etiqueta icon={icons.fechar} label="Cancelada" tone="negativo" />
          ) : (
            <Etiqueta
              icon={icons.perfil}
              label={livres > 0 ? plural(livres, 'lugar livre', 'lugares livres') : 'Cheia'}
              tone={livres > 0 ? 'positivo' : 'neutro'}
            />
          )}
          <Etiqueta
            icon={icons.rota}
            label={`${formatarDistancia(boleia.distanceM)} · ${duracao(boleia.durationS)}`}
            tone="neutro"
          />
        </View>
        {boleia.note ? <ThemedText>{boleia.note}</ThemedText> : null}
        <Button
          label="Ver o ponto de encontro no mapa"
          variant="secondary"
          icon={icons.carro}
          onPress={() => abrirDirecoes(boleia.origin, 'carro')}
        />
      </Card>

      <SectionHeader title="Quanto custa" />
      <Card style={styles.grupo}>
        <LinhaValor
          rotulo={`Combustível${boleia.roundTrip ? ' (ida e volta)' : ''}`}
          valor={formatarCentimos(boleia.fuelCents)}
        />
        <LinhaValor
          rotulo={`Portagens${boleia.tollM > 0 ? ` · ${formatarDistancia(boleia.tollM)} pagos por sentido` : ''}`}
          valor={formatarCentimos(boleia.tollCents)}
        />
        <LinhaValor rotulo="Total" valor={formatarCentimos(boleia.totalCents)} destaque />
        <View style={[styles.separador, { backgroundColor: theme.border }]} />
        <LinhaValor
          rotulo={`Cada um agora (${plural(1 + boleia.seatsTaken, 'pessoa', 'pessoas')})`}
          valor={formatarCentimos(boleia.shareNowCents)}
          destaque
        />
        <LinhaValor
          rotulo={`Com a boleia cheia (${plural(1 + boleia.seatsOffered, 'pessoa', 'pessoas')})`}
          valor={formatarCentimos(boleia.shareFullCents)}
        />
        <ThemedText type="small" themeColor="textMuted">
          Portagens estimadas com os preços de 2026 (classe 1). O combustível usa o consumo e o
          preço que o condutor indicou. O condutor também paga a sua parte.
        </ThemedText>
      </Card>

      {podeVerPessoas ? (
        <>
          <SectionHeader title="No carro" />
          <Card style={styles.grupo}>
            {noCarro.map((pessoa) => (
              <LinhaValor
                key={pessoa.profileId}
                rotulo={pessoa.name}
                valor={pessoa.status === 'driver' ? 'Condutor' : 'Passageiro'}
              />
            ))}
          </Card>
        </>
      ) : null}

      {boleia.isMine && pedidos.length > 0 ? (
        <>
          <SectionHeader title="Pedidos" trailing={String(pedidos.length)} />
          {pedidos.map((pedido) => (
            <Card key={pedido.profileId} style={styles.grupo}>
              <ThemedText style={styles.destaque}>{pedido.name}</ThemedText>
              <View style={styles.botoes}>
                <View style={styles.botao}>
                  <Button
                    label="Aceitar"
                    icon={icons.selecionado}
                    disabled={aTratar || livres <= 0}
                    onPress={() =>
                      void executar(() => answerRequest(boleia.id, pedido.profileId, true))
                    }
                  />
                </View>
                <View style={styles.botao}>
                  <Button
                    label="Recusar"
                    variant="secondary"
                    icon={icons.fechar}
                    disabled={aTratar}
                    onPress={() =>
                      void executar(() => answerRequest(boleia.id, pedido.profileId, false))
                    }
                  />
                </View>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {cancelada ? null : boleia.isMine ? (
        <Button
          label="Cancelar boleia"
          variant="danger"
          icon={icons.fechar}
          disabled={aTratar}
          onPress={() =>
            Alert.alert('Cancelar a boleia?', 'Quem já tinha lugar deixa de ter.', [
              { text: 'Não', style: 'cancel' },
              {
                text: 'Cancelar',
                style: 'destructive',
                onPress: () => void executar(() => cancelRide(boleia.id)),
              },
            ])
          }
        />
      ) : boleia.myStatus === 'requested' || boleia.myStatus === 'accepted' ? (
        <>
          <ThemedText themeColor="textSecondary" style={styles.centro}>
            {boleia.myStatus === 'accepted'
              ? 'Tens lugar. Combina os pormenores com o condutor no ponto de encontro.'
              : 'Pedido enviado. O condutor ainda tem de aceitar.'}
          </ThemedText>
          <Button
            label={boleia.myStatus === 'accepted' ? 'Sair da boleia' : 'Cancelar pedido'}
            variant="secondary"
            icon={icons.fechar}
            disabled={aTratar}
            onPress={() => void executar(() => leaveRide(boleia.id))}
          />
        </>
      ) : (
        <Button
          label={livres > 0 ? 'Pedir lugar' : 'Boleia cheia'}
          icon={icons.perfil}
          disabled={aTratar || livres <= 0}
          onPress={() => void executar(() => requestSeat(boleia.id))}
        />
      )}

      <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
        Percurso: © contribuidores do OpenStreetMap, Valhalla (FOSSGIS)
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grupo: {
    gap: Spacing.two,
  },
  titulo: {
    fontSize: 26,
    lineHeight: 30,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  linhaValor: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  valor: {
    fontVariant: ['tabular-nums'],
  },
  destaque: {
    fontWeight: 800,
  },
  separador: {
    height: 1,
    marginVertical: 4,
  },
  botoes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  botao: {
    flex: 1,
  },
  centro: {
    textAlign: 'center',
  },
});
