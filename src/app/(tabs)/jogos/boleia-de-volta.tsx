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
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
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
}: {
  carro: ReturnRide;
  ocupado: boolean;
  onPedir: () => void;
  onCancelar: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.carro, { borderColor: theme.border }]}>
      <View style={styles.topo}>
        <ThemedText style={styles.nome} numberOfLines={1}>
          {carro.driverName}
        </ThemedText>
        <ThemedText style={styles.preco}>{formatarCentimos(carro.priceCents)}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {carro.parkingName
          ? `Carro no ${carro.parkingName} · volta para ${carro.originName}`
          : `Volta para ${carro.originName}`}
      </ThemedText>
      <View style={styles.etiquetas}>
        <Etiqueta
          icon={icons.perfil}
          label={plural(carro.seatsLeft, 'lugar livre', 'lugares livres')}
          tone="positivo"
        />
        <Etiqueta
          icon={icons.selecionado}
          label={
            carro.driverCompleted === 0 && carro.driverFaults === 0
              ? 'Primeira boleia'
              : `${plural(carro.driverCompleted, 'boleia', 'boleias')} · ${plural(carro.driverFaults, 'falta', 'faltas')}`
          }
          tone={carro.driverFaults > 0 ? 'aviso' : 'neutro'}
        />
      </View>

      {carro.myStatus === 'accepted' ? (
        <>
          <ThemedText themeColor="textSecondary">
            Tens lugar na volta. Vai ter ao carro e combina com o condutor.
          </ThemedText>
          <View style={styles.acoes}>
            {carro.parking ? (
              <LinkTexto
                label="Como chegar ao carro"
                onPress={() => carro.parking && abrirDirecoes(carro.parking, 'a-pe')}
              />
            ) : null}
            <LinkTexto neutro label="Já não preciso" onPress={onCancelar} />
          </View>
        </>
      ) : carro.myStatus === 'pending' ? (
        <>
          <ThemedText themeColor="textSecondary">
            Pedido enviado. O condutor foi avisado no telemóvel e sabe a que distância estás do
            carro.
          </ThemedText>
          <LinkTexto perigo label="Retirar o pedido" onPress={onCancelar} />
        </>
      ) : (
        <Button
          label="Pedir boleia de volta"
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

  return (
    <Screen>
      <SectionHeader title="Boleia de volta" />
      <Card style={styles.card}>
        <ThemedText themeColor="textSecondary">
          Ficaste sem transporte? Estes carros voltam deste jogo e ainda têm lugar. Pagas a tua
          parte da viagem de volta.
        </ThemedText>
        {!aberto ? (
          <ThemedText themeColor="textSecondary">
            {agora < janela.abre.getTime()
              ? `Os pedidos abrem às ${formatarHora(janela.abre)}, por volta do intervalo.`
              : `Os pedidos fecharam às ${formatarHora(janela.fecha)}: a esta hora os carros já foram.`}
          </ThemedText>
        ) : carros.isLoading ? (
          <ThemedText themeColor="textSecondary">A procurar carros a voltar…</ThemedText>
        ) : lista.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            Ninguém tem lugar na volta neste momento. Vai vendo: os condutores ainda podem abrir
            lugares até às {formatarHora(janela.fecha)}.
          </ThemedText>
        ) : (
          <View style={styles.lista}>
            {[
              ...lista
                .reduce((grupos, carro) => {
                  const destino = carro.originCity ?? 'Sem destino indicado';
                  grupos.set(destino, [...(grupos.get(destino) ?? []), carro]);
                  return grupos;
                }, new Map<string, ReturnRide[]>())
                .entries(),
            ].map(([destino, doDestino]) => (
              <View key={destino} style={styles.lista}>
                <ThemedText type="eyebrow" themeColor="accentInk">
                  {`Para ${destino}`}
                </ThemedText>
                {doDestino.map((carro) => (
                  <Carro
                    key={carro.rideId}
                    carro={carro}
                    ocupado={ocupado}
                    onPedir={() => void pedir(carro.rideId)}
                    onCancelar={() => void cancelar(carro.rideId)}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
        {erro ? <Aviso tone="erro" title="Não deu" message={erro} /> : null}
      </Card>

      <Aviso
        tone="aviso"
        title="Um lugar na volta é um compromisso"
        message="Vale como qualquer outro lugar: se o condutor aceitar e não apareceres, conta como falta."
      />
      <ThemedText type="small" themeColor="textMuted">
        O condutor só vê a que distância estás do carro, arredondada a 100 m. A tua localização não
        é guardada nem mostrada a ninguém.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  lista: {
    gap: Spacing.two,
  },
  carro: {
    gap: Spacing.two,
    paddingVertical: Spacing.twoAndHalf,
    paddingHorizontal: Spacing.twoAndHalf,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  nome: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  preco: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
