import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getCurrentPosition } from '@/features/presence/location';
import {
  cancelReturnRequest,
  requestReturnSeat,
  RideRefused,
  type ReturnRide,
} from '@/features/rides/api';
import { useRefreshRides, useReturnBoard } from '@/features/rides/hooks/useRides';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarHora } from '@/lib/datas';
import { abrirDirecoes } from '@/lib/direcoes';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { ativarNotificacoesDeBoleias } from '@/lib/push';
import { janelaDaVolta, podePedirVolta } from '@/lib/regras-volta';
import { useUserId } from '@/lib/session';
import { usePlanosJogos } from '@/state/planos-jogos';
import { obterJogo } from '@/mocks/jogos';
import { Aviso } from '@/ui/aviso';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { LinhaDetalhes } from '@/ui/linha-detalhes';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof RideRefused)) {
    return 'Não deu para pedir a boleia de volta. Tenta outra vez daqui a pouco.';
  }
  switch (erro.reason) {
    case 'outside_window':
      return 'Os pedidos de boleia de volta já fecharam para este jogo.';
    case 'no_return_seats':
      return 'Este condutor já não aceita pedidos de boleia de volta.';
    case 'ride_full':
      return 'Este carro já vai cheio na volta. Vê se há outro.';
    case 'already_going':
      return 'Já tens lugar nesta boleia: vais com ela na volta.';
    case 'own_ride':
      return 'Esta boleia é tua.';
    case 'suspended':
      return 'Estás suspenso das boleias por faltas anteriores.';
    case 'too_far':
      return 'Estás demasiado longe do estádio para esta boleia de volta.';
    case 'bad_location':
      return 'Não conseguimos saber onde estás. Liga a localização e tenta outra vez.';
    case 'rate_limited':
      return 'Já pediste boleia de volta a muita gente hoje. Fala com alguém no estádio.';
    default:
      return 'Não deu para pedir a boleia de volta. Tenta outra vez daqui a pouco.';
  }
}

function Carro({
  carro,
  ocupado,
  onPedir,
  onCancelar,
  separador,
}: {
  carro: ReturnRide;
  ocupado: boolean;
  onPedir: () => void;
  onCancelar: () => void;
  separador: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.carro,
        separador && { borderBottomWidth: 1, borderBottomColor: theme.backgroundSelected },
      ]}>
      <View style={styles.topo}>
        <View style={styles.corpo}>
          <ThemedText style={styles.nome} numberOfLines={1}>
            {carro.driverName}
          </ThemedText>
          <LinhaDetalhes
            partes={[
              `volta para ${carro.originName}`,
              carro.parkingName ? `carro no ${carro.parkingName}` : null,
              plural(carro.seatsLeft, 'lugar livre', 'lugares livres'),
              carro.driverCompleted === 0 && carro.driverFaults === 0
                ? 'primeira boleia'
                : `${plural(carro.driverCompleted, 'boleia', 'boleias')} · ${plural(carro.driverFaults, 'falta', 'faltas')}`,
            ]}
          />
        </View>
        <ThemedText style={styles.preco}>{formatarCentimos(carro.priceCents)}</ThemedText>
      </View>

      {carro.myStatus === 'accepted' ? (
        <View style={styles.acoes}>
          <Etiqueta icon={icons.checkInFeito} label="Tens lugar na volta" tone="positivo" />
          {carro.parking ? (
            <LinkTexto
              label="Como chegar ao carro"
              onPress={() => carro.parking && abrirDirecoes(carro.parking, 'a-pe')}
            />
          ) : null}
          <LinkTexto neutro label="Já não preciso" onPress={onCancelar} />
        </View>
      ) : carro.myStatus === 'pending' ? (
        <View style={styles.acoes}>
          <Etiqueta icon={icons.horario} label="Pedido enviado" tone="aviso" />
          <LinkTexto perigo label="Retirar o pedido" onPress={onCancelar} />
        </View>
      ) : (
        <Button
          label="Pedir lugar na volta"
          icon={icons.carro}
          variant="secondary"
          disabled={ocupado}
          onPress={onPedir}
        />
      )}
    </View>
  );
}

/**
 * For a fan left at the stadium: the cars going back with a free seat. They pay their share of the way home, the
 * driver is told how far they are from the car, and the answer arrives as a notification. Their exact position is
 * never shown to anyone — only that distance.
 */
export default function BoleiaDeVoltaScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { jogoId } = useLocalSearchParams<{ jogoId?: string }>();
  const jogo = jogoId ? obterJogo(jogoId) : undefined;
  const userId = useUserId();
  const agora = useNow(30 * 1000);
  const { garantirVou } = usePlanosJogos();
  const atualizar = useRefreshRides();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const aberto = jogo ? podePedirVolta(jogo.inicio, agora) : false;
  const carros = useReturnBoard(jogo?.id ?? null, userId !== null && aberto);

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Precisas de conta"
          message="Para pedir boleia de volta, o condutor tem de saber quem vai no carro."
          action={{ label: 'Entrar', onPress: () => router.push('/conta/entrar') }}
        />
      </Screen>
    );
  }

  if (!jogo) {
    return (
      <Screen>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Jogo não encontrado"
          message="Volta ao teu jogo e tenta outra vez."
          action={{ label: 'Voltar', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const janela = janelaDaVolta(jogo.inicio);

  async function pedir(rideId: string) {
    setErro(null);
    setOcupado(true);
    try {
      const posicao = await getCurrentPosition();
      if (posicao.status !== 'ok') {
        setErro(
          posicao.status === 'denied'
            ? 'Precisamos da localização para dizer ao condutor a que distância estás do carro.'
            : 'Não conseguimos saber onde estás. Tenta outra vez ao ar livre.'
        );
        return;
      }
      await ativarNotificacoesDeBoleias();
      await requestReturnSeat(rideId, {
        latitude: posicao.position.latitude,
        longitude: posicao.position.longitude,
      });
      // `jogo` já foi verificado acima, mas o estreitamento não sobrevive dentro desta função.
      if (jogo) await garantirVou(jogo.id).catch(() => undefined);
      void atualizar();
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar(rideId: string) {
    setErro(null);
    setOcupado(true);
    try {
      await cancelReturnRequest(rideId);
      void atualizar();
    } catch {
      setErro('Não deu para retirar o pedido. Tenta outra vez.');
    } finally {
      setOcupado(false);
    }
  }

  const lista = carros.data ?? [];

  const porDestino = [
    ...lista
      .reduce((grupos, carro) => {
        const destino = carro.originCity ?? 'Sem destino indicado';
        grupos.set(destino, [...(grupos.get(destino) ?? []), carro]);
        return grupos;
      }, new Map<string, ReturnRide[]>())
      .entries(),
  ];

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">
        Estes carros voltam deste jogo e ainda têm lugar. Pagas a tua parte da volta.
      </ThemedText>

      {!aberto ? (
        <Card>
          <ThemedText themeColor="textSecondary">
            {agora < janela.abre.getTime()
              ? `Os pedidos abrem às ${formatarHora(janela.abre)}, por volta do intervalo.`
              : `Os pedidos fecharam às ${formatarHora(janela.fecha)}: a esta hora os carros já foram.`}
          </ThemedText>
        </Card>
      ) : carros.isLoading ? (
        <SkeletonCard lines={3} />
      ) : lista.length === 0 ? (
        <Card>
          <ThemedText style={styles.destaque}>Ninguém tem lugar na volta, por agora</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`Vai vendo: os condutores podem abrir lugares até às ${formatarHora(janela.fecha)}.`}
          </ThemedText>
        </Card>
      ) : (
        porDestino.map(([destino, doDestino]) => (
          <View key={destino} style={styles.grupo}>
            <SectionHeader title={`Para ${destino}`} />
            <Card style={styles.linhas}>
              {doDestino.map((carro, indice) => (
                <Carro
                  key={carro.rideId}
                  carro={carro}
                  ocupado={ocupado}
                  separador={indice < doDestino.length - 1}
                  onPedir={() => void pedir(carro.rideId)}
                  onCancelar={() => void cancelar(carro.rideId)}
                />
              ))}
            </Card>
          </View>
        ))
      )}

      {erro ? <Aviso tone="erro" title="Não deu" message={erro} /> : null}

      <View style={styles.rodape}>
        <ThemedText type="small" style={{ color: theme.warningText }}>
          Um lugar na volta é um compromisso: se o condutor aceitar e não apareceres, conta como
          falta.
        </ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          O condutor só vê a que distância estás do carro, arredondada a 100 m.
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grupo: {
    gap: Spacing.threeAndHalf,
  },
  linhas: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  carro: {
    gap: Spacing.twoAndHalf,
    paddingVertical: Spacing.twoAndHalf,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.twoAndHalf,
  },
  corpo: {
    flex: 1,
    gap: Spacing.half,
  },
  nome: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 800,
  },
  preco: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  destaque: {
    fontWeight: 800,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rodape: {
    gap: Spacing.one,
  },
});
