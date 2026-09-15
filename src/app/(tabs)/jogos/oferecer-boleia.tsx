import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import MapView, { MapMarker } from 'react-native-maps';

import { Radius, Spacing } from '@/constants/theme';
import { getCurrentPosition } from '@/features/presence/location';
import {
  createRide,
  quoteRide,
  RideRefused,
  type RideQuote,
  type RouteOption,
} from '@/features/rides/api';
import { useRefreshRides } from '@/features/rides/hooks/useRides';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { formatarDistancia } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import type { Coordenadas } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

/** DGEG weekly averages, 14–20 September 2026 (the driver can change it). */
const COMBUSTIVEIS = [
  { id: 'gasolina', nome: 'Gasolina 95', milesimas: 2072 },
  { id: 'gasoleo', nome: 'Gasóleo', milesimas: 2152 },
] as const;
const HORAS_ANTES = [1, 2, 3, 4, 6] as const;
const LUGARES = [1, 2, 3, 4, 5, 6, 7] as const;
const HORA_MS = 60 * 60 * 1000;
const DELTA = 0.05;

const OPCOES: Record<RouteOption, { titulo: string; descricao: string }> = {
  rapida: { titulo: 'Mais rápido', descricao: 'Pelo caminho mais curto em tempo, com portagens.' },
  equilibrio: { titulo: 'Equilíbrio', descricao: 'Poupa portagens sem perder muito tempo.' },
  sem_portagens: { titulo: 'Sem portagens', descricao: 'Evita todas as portagens que pode.' },
};

/** "6,5" -> 650 centilitres per 100 km, with integer maths; `null` when it is not a plausible consumption. */
function lerConsumo(texto: string) {
  const partes = /^(\d{1,2})(?:[.,](\d))?$/.exec(texto.trim());
  if (!partes) return null;
  const centilitros = Number(partes[1]) * 100 + Number(partes[2] ?? '0') * 10;
  return centilitros >= 200 && centilitros <= 2500 ? centilitros : null;
}

/** "2,072" -> 2072 thousandths of a euro per litre; `null` outside 0,500–4,000 €. */
function lerPrecoLitro(texto: string) {
  const partes = /^(\d)(?:[.,](\d{1,3}))?$/.exec(texto.trim().replace(/\s*€$/, ''));
  if (!partes) return null;
  const milesimas = Number(partes[1]) * 1000 + Number((partes[2] ?? '').padEnd(3, '0') || '0');
  return milesimas >= 500 && milesimas <= 4000 ? milesimas : null;
}

function duracao(segundos: number) {
  const minutos = Math.round(segundos / 60);
  const horas = Math.floor(minutos / 60);
  return horas > 0 ? `${horas} h ${String(minutos % 60).padStart(2, '0')}` : `${minutos} min`;
}

function mensagemRecusa(erro: unknown) {
  if (!(erro instanceof RideRefused)) return 'Verifica a ligação e tenta outra vez.';
  switch (erro.reason) {
    case 'too_far':
      return 'O ponto de partida fica demasiado longe do estádio.';
    case 'no_route':
      return 'Não encontrámos caminho de carro até ao estádio a partir daí.';
    case 'rate_limited':
      return 'Pediste muitos percursos numa hora. Tenta daqui a pouco.';
    case 'bad_departure':
      return 'A hora de saída tem de ser depois de agora e antes do apito.';
    case 'fixture_started':
      return 'Este jogo já começou.';
    default:
      return 'Não deu para concluir. Tenta outra vez.';
  }
}

/** A driver offers seats for a game: meeting point, time, seats and car, then picks a route with its cost. */
export default function OferecerBoleiaScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const atualizar = useRefreshRides();
  const mapa = useRef<MapView>(null);
  const { jogoId } = useLocalSearchParams<{ jogoId: string }>();
  const jogo = jogoId ? obterJogo(jogoId) : undefined;
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;

  const [partida, setPartida] = useState<Coordenadas | null>(null);
  const [nomePartida, setNomePartida] = useState('');
  const [horasAntes, setHorasAntes] = useState<(typeof HORAS_ANTES)[number]>(3);
  const [lugares, setLugares] = useState<(typeof LUGARES)[number]>(3);
  const [consumo, setConsumo] = useState('6,5');
  const [combustivel, setCombustivel] = useState<(typeof COMBUSTIVEIS)[number]['id']>('gasolina');
  const [precoLitro, setPrecoLitro] = useState('2,072');
  const [idaEVolta, setIdaEVolta] = useState(true);
  const [nota, setNota] = useState('');
  const [cotacoes, setCotacoes] = useState<RideQuote[] | null>(null);
  const [escolhida, setEscolhida] = useState<RouteOption | null>(null);
  const [aCarregar, setACarregar] = useState(false);

  // Start the map where the driver is, when they allow it; otherwise around the stadium.
  useEffect(() => {
    let ativo = true;
    void getCurrentPosition().then((resultado) => {
      if (!ativo || resultado.status !== 'ok') return;
      const aqui = {
        latitude: resultado.position.latitude,
        longitude: resultado.position.longitude,
      };
      setPartida((atual) => atual ?? aqui);
      mapa.current?.animateToRegion({ ...aqui, latitudeDelta: DELTA, longitudeDelta: DELTA }, 300);
    });
    return () => {
      ativo = false;
    };
  }, []);

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Precisas de conta"
          message="Quem pede lugar tem de saber com quem vai: entra para oferecer boleia."
          action={{ label: 'Entrar', onPress: () => router.push('/conta/entrar') }}
        />
      </Screen>
    );
  }

  if (!jogo || !estadio) {
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

  const consumoCl = lerConsumo(consumo);
  const precoMilesimas = lerPrecoLitro(precoLitro);
  const inicio = new Date(jogo.inicio);
  const saida = new Date(inicio.getTime() - horasAntes * HORA_MS);
  const nomeLimpo = nomePartida.trim();
  const podeCotar = partida !== null && consumoCl !== null && precoMilesimas !== null;
  const cotacao = cotacoes?.find((candidata) => candidata.option === escolhida) ?? null;

  function mudou() {
    // Anything that changes the cost makes the quotes stale.
    setCotacoes(null);
    setEscolhida(null);
  }

  async function verPercursos() {
    if (!partida || consumoCl === null || precoMilesimas === null || !jogo) return;
    setACarregar(true);
    try {
      const resultado = await quoteRide({
        fixtureId: jogo.id,
        origin: partida,
        consumptionClPer100Km: consumoCl,
        fuelPriceMilliPerLitre: precoMilesimas,
        roundTrip: idaEVolta,
      });
      setCotacoes(resultado);
      setEscolhida(resultado[0]?.option ?? null);
    } catch (erro) {
      Alert.alert('Sem percursos', mensagemRecusa(erro));
    } finally {
      setACarregar(false);
    }
  }

  async function publicar() {
    if (!partida || consumoCl === null || precoMilesimas === null || !escolhida || !jogo) return;
    if (nomeLimpo.length < 2) {
      Alert.alert(
        'Falta o ponto de encontro',
        'Diz onde apanhas a malta (ex.: Estação de Coimbra-B).'
      );
      return;
    }
    setACarregar(true);
    try {
      const id = await createRide({
        fixtureId: jogo.id,
        origin: partida,
        originName: nomeLimpo,
        consumptionClPer100Km: consumoCl,
        fuelPriceMilliPerLitre: precoMilesimas,
        roundTrip: idaEVolta,
        departureAt: saida.toISOString(),
        seatsOffered: lugares,
        routeOption: escolhida,
        note: nota.trim(),
      });
      await atualizar();
      router.replace({ pathname: '/jogos/boleia', params: { rideId: id, jogoId: jogo.id } });
    } catch (erro) {
      Alert.alert('Não foi possível publicar', mensagemRecusa(erro));
    } finally {
      setACarregar(false);
    }
  }

  return (
    <Screen>
      <SectionHeader title="Ponto de encontro" />
      <Card style={styles.grupo}>
        <View style={styles.mapaArea}>
          <MapView
            ref={mapa}
            style={StyleSheet.absoluteFill}
            initialRegion={{
              ...estadio.coordenadas,
              latitudeDelta: DELTA * 4,
              longitudeDelta: DELTA * 4,
            }}
            onPress={(evento) => {
              setPartida(evento.nativeEvent.coordinate);
              mudou();
            }}
            pitchEnabled={false}
            rotateEnabled={false}
            toolbarEnabled={false}
            accessibilityLabel="Mapa para escolher o ponto de encontro. Toca para pôr o pino.">
            {partida ? (
              <MapMarker
                coordinate={partida}
                draggable
                onDragEnd={(evento) => {
                  setPartida(evento.nativeEvent.coordinate);
                  mudou();
                }}
                pinColor={theme.accent}
                title="Ponto de encontro"
              />
            ) : null}
          </MapView>
        </View>
        <ThemedText type="small" themeColor="textMuted">
          Toca no mapa ou arrasta o pino. Escolhe um sítio público (uma estação, uma bomba de
          gasolina), nunca a tua casa.
        </ThemedText>
        <Campo
          label="Nome do ponto de encontro"
          value={nomePartida}
          onChangeText={setNomePartida}
          placeholder="Ex.: Estação de Coimbra-B"
          maxLength={80}
          autoCapitalize="words"
        />
      </Card>

      <SectionHeader title="Quando e quantos" />
      <Card style={styles.grupo}>
        <ThemedText style={styles.rotulo}>Saída antes do apito</ThemedText>
        <View style={styles.chips}>
          {HORAS_ANTES.map((horas) => (
            <Chip
              key={horas}
              label={`${horas} h`}
              selected={horas === horasAntes}
              emCartao
              onPress={() => setHorasAntes(horas)}
            />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {`Sais ${formatarDiaEHora(saida).toLowerCase()}${jogo.horaConfirmada ? '' : ' (a hora do jogo ainda está por definir)'}.`}
        </ThemedText>
        <ThemedText style={styles.rotulo}>Lugares livres</ThemedText>
        <View style={styles.chips}>
          {LUGARES.map((numero) => (
            <Chip
              key={numero}
              label={String(numero)}
              selected={numero === lugares}
              emCartao
              onPress={() => setLugares(numero)}
            />
          ))}
        </View>
      </Card>

      <SectionHeader title="O teu carro" />
      <Card style={styles.grupo}>
        <Campo
          label="Consumo (litros aos 100 km)"
          value={consumo}
          onChangeText={(texto) => {
            setConsumo(texto);
            mudou();
          }}
          keyboardType="decimal-pad"
          erro={consumo && consumoCl === null ? 'Escreve um valor entre 2 e 25, ex.: 6,5' : null}
        />
        <View style={styles.chips}>
          {COMBUSTIVEIS.map((opcao) => (
            <Chip
              key={opcao.id}
              label={opcao.nome}
              selected={opcao.id === combustivel}
              emCartao
              onPress={() => {
                setCombustivel(opcao.id);
                setPrecoLitro((opcao.milesimas / 1000).toFixed(3).replace('.', ','));
                mudou();
              }}
            />
          ))}
        </View>
        <Campo
          label="Preço por litro (€)"
          value={precoLitro}
          onChangeText={(texto) => {
            setPrecoLitro(texto);
            mudou();
          }}
          keyboardType="decimal-pad"
          ajuda="Média da DGEG na semana de 14 a 20 de setembro. Muda se pagaste outro valor."
          erro={precoLitro && precoMilesimas === null ? 'Escreve um preço como 2,072' : null}
        />
        <View style={styles.linhaSwitch}>
          <ThemedText style={styles.flex}>Ida e volta</ThemedText>
          <Switch
            value={idaEVolta}
            onValueChange={(valor) => {
              setIdaEVolta(valor);
              mudou();
            }}
            trackColor={{ true: theme.accent, false: theme.border }}
            thumbColor={theme.accentText}
            ios_backgroundColor={theme.border}
            accessibilityLabel="Ida e volta"
          />
        </View>
        <Campo
          label="Nota para quem vai (opcional)"
          value={nota}
          onChangeText={setNota}
          placeholder="Ex.: saio pontualmente, cabe uma mochila"
          maxLength={280}
        />
      </Card>

      <Button
        label={aCarregar && !cotacoes ? 'A calcular…' : 'Ver percursos e custos'}
        icon={icons.rota}
        variant={cotacoes ? 'secondary' : 'primary'}
        disabled={!podeCotar || aCarregar}
        onPress={() => void verPercursos()}
      />
      {partida === null ? (
        <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
          Põe primeiro o ponto de encontro no mapa.
        </ThemedText>
      ) : null}

      {cotacoes ? (
        <>
          <SectionHeader title="Escolhe o percurso" />
          {cotacoes.map((opcao) => {
            const selecionada = opcao.option === escolhida;
            return (
              <Pressable
                key={opcao.option}
                onPress={() => setEscolhida(opcao.option)}
                accessibilityRole="radio"
                accessibilityState={{ selected: selecionada }}
                style={[
                  styles.opcao,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: selecionada ? theme.accent : theme.border,
                  },
                ]}>
                <View style={styles.opcaoTopo}>
                  <ThemedText style={styles.opcaoTitulo}>{OPCOES[opcao.option].titulo}</ThemedText>
                  <ThemedText style={styles.opcaoTitulo}>
                    {formatarCentimos(opcao.totalCents)}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {`${duracao(opcao.durationS)} · ${formatarDistancia(opcao.distanceM)} · ${opcao.tollM > 0 ? `${formatarDistancia(opcao.tollM)} com portagem` : 'sem portagens'}`}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {`Combustível ${formatarCentimos(opcao.fuelCents)} · portagens ${formatarCentimos(opcao.tollCents)} (estimativa)`}
                </ThemedText>
                <ThemedText type="small" themeColor="textMuted">
                  {OPCOES[opcao.option].descricao}
                </ThemedText>
              </Pressable>
            );
          })}

          {cotacao ? (
            <Card style={styles.grupo}>
              <ThemedText style={styles.rotulo}>Quanto paga cada um</ThemedText>
              {cotacao.shareCentsByPeople.slice(0, lugares + 1).map((valor, indice) => (
                <View key={indice} style={styles.linhaValor}>
                  <ThemedText themeColor="textSecondary">
                    {indice === 0 ? 'Só tu' : `Tu e mais ${indice}`}
                  </ThemedText>
                  <ThemedText style={styles.valor}>{`${formatarCentimos(valor)} cada`}</ThemedText>
                </View>
              ))}
            </Card>
          ) : null}

          <Button
            label={aCarregar ? 'A publicar…' : 'Publicar boleia'}
            icon={icons.carro}
            disabled={!escolhida || aCarregar}
            onPress={() => void publicar()}
          />
          <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
            Percursos: © contribuidores do OpenStreetMap, Valhalla (FOSSGIS)
          </ThemedText>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grupo: {
    gap: Spacing.two,
  },
  mapaArea: {
    height: 240,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  rotulo: {
    fontWeight: 800,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  linhaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  centro: {
    textAlign: 'center',
  },
  opcao: {
    gap: 4,
    padding: 14,
    borderWidth: 2,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  opcaoTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  opcaoTitulo: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 800,
  },
  linhaValor: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  valor: {
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
});
