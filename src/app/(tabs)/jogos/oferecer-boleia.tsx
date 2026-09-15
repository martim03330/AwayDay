import { skipToken, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import MapView, { MapMarker } from 'react-native-maps';

import { CompromissoBoleia } from '@/components/compromisso-boleia';
import { Radius, Spacing } from '@/constants/theme';
import { fetchStadiumParking } from '@/features/parking/api';
import { getCurrentPosition } from '@/features/presence/location';
import {
  createRide,
  fetchReputation,
  quoteRide,
  RideRefused,
  searchPlace,
  type PlaceResult,
  type RideQuote,
  type RouteOption,
} from '@/features/rides/api';
import { useRefreshRides, useRideBoard } from '@/features/rides/hooks/useRides';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarData, formatarDiaEHora } from '@/lib/datas';
import { formatarDistancia } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { CRIAR_HORAS_ANTES, podeCriarBoleia } from '@/lib/regras-boleia';
import { ativarNotificacoesDeBoleias } from '@/lib/push';
import { useUserId } from '@/lib/session';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import type { Coordenadas } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { LinkTexto } from '@/ui/link-texto';
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
    case 'already_offering':
      return 'Já ofereces boleia para este jogo.';
    case 'suspended':
      return 'Estás suspenso das boleias por faltas.';
    case 'rules_not_accepted':
      return 'Tens de aceitar as regras das boleias para publicar.';
    case 'bad_parking':
      return 'Esse parque não é deste estádio. Escolhe outro.';
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
  const [aquiEstou, setAquiEstou] = useState<Coordenadas | null>(null);
  const [localizacaoNegada, setLocalizacaoNegada] = useState(false);
  const [mapaPronto, setMapaPronto] = useState(false);
  const [pesquisa, setPesquisa] = useState('');
  const [resultados, setResultados] = useState<PlaceResult[] | null>(null);
  const [aProcurar, setAProcurar] = useState(false);
  const [compromisso, setCompromisso] = useState(false);
  const [parqueId, setParqueId] = useState<string | null>(null);
  const agora = useNow(60 * 1000);
  const quadro = useRideBoard(jogo?.id ?? null, userId !== null);
  const reputacao = useQuery({
    queryKey: ['rides', 'reputation', userId],
    queryFn: userId ? () => fetchReputation(userId) : skipToken,
    meta: { persist: false },
  });
  const parques = useQuery({
    queryKey: ['parking', estadio?.id ?? null],
    queryFn: estadio ? () => fetchStadiumParking(estadio.id) : skipToken,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const minhaBoleia = quadro.data?.find((boleia) => boleia.isMine && boleia.status === 'open');

  // The ride starts near the driver, not near the stadium: find where they are, when they allow it.
  useEffect(() => {
    let ativo = true;
    void getCurrentPosition().then((resultado) => {
      if (!ativo) return;
      if (resultado.status !== 'ok') {
        setLocalizacaoNegada(true);
        return;
      }
      const aqui = {
        latitude: resultado.position.latitude,
        longitude: resultado.position.longitude,
      };
      setAquiEstou(aqui);
      setPartida((atual) => atual ?? aqui);
    });
    return () => {
      ativo = false;
    };
  }, []);

  // The map only moves once it is ready; before that, a move is silently lost.
  const latitudePartida = partida?.latitude;
  const longitudePartida = partida?.longitude;
  useEffect(() => {
    if (!mapaPronto || latitudePartida === undefined || longitudePartida === undefined) return;
    mapa.current?.animateToRegion(
      {
        latitude: latitudePartida,
        longitude: longitudePartida,
        latitudeDelta: DELTA / 2,
        longitudeDelta: DELTA / 2,
      },
      300
    );
  }, [mapaPronto, latitudePartida, longitudePartida]);

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

  if (minhaBoleia && jogo) {
    return (
      <Screen>
        <EmptyState
          icon={icons.carro}
          title="Já ofereces boleia"
          message="Só dá para ter uma boleia aberta por jogo. Para mudar alguma coisa, cancela-a e abre outra."
          action={{
            label: 'Ver a minha boleia',
            onPress: () =>
              router.replace({
                pathname: '/jogos/boleia',
                params: { rideId: minhaBoleia.id, jogoId: jogo.id },
              }),
          }}
        />
      </Screen>
    );
  }

  const suspensoAte = reputacao.data?.bannedUntil ?? null;
  if (suspensoAte) {
    return (
      <Screen>
        <EmptyState
          icon={icons.aviso}
          title="Estás suspenso das boleias"
          message={`Por faltas em boleias anteriores, só podes voltar a oferecer boleia a partir de ${formatarData(new Date(suspensoAte))}.`}
          action={{ label: 'Voltar', onPress: () => router.back() }}
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
  // A ride is published at least 3 h before it leaves: only departure times still far enough ahead.
  const horasPossiveis = HORAS_ANTES.filter((horas) =>
    podeCriarBoleia(new Date(inicio.getTime() - horas * HORA_MS), agora)
  );
  const horasEfetivas = horasPossiveis.includes(horasAntes)
    ? horasAntes
    : (horasPossiveis[0] ?? horasAntes);
  const saida = new Date(inicio.getTime() - horasEfetivas * HORA_MS);
  const semTempo = horasPossiveis.length === 0;
  const parquesDoEstadio = (parques.data?.spots ?? []).filter(
    (parque) => parque.openOnMatchdays !== false
  );
  const nomeLimpo = nomePartida.trim();
  const podeCotar = partida !== null && consumoCl !== null && precoMilesimas !== null;
  const cotacao = cotacoes?.find((candidata) => candidata.option === escolhida) ?? null;

  function mudou() {
    // Anything that changes the cost makes the quotes stale.
    setCotacoes(null);
    setEscolhida(null);
  }

  async function procurar() {
    const texto = pesquisa.trim();
    if (texto.length < 3) return;
    setAProcurar(true);
    try {
      setResultados(await searchPlace(texto, aquiEstou ?? partida));
    } catch (erro) {
      Alert.alert(
        'Sem resultados',
        erro instanceof RideRefused && erro.reason === 'rate_limited'
          ? 'Fizeste muitas pesquisas numa hora. Tenta daqui a pouco.'
          : 'Verifica a ligação e tenta outra vez.'
      );
    } finally {
      setAProcurar(false);
    }
  }

  function escolherResultado(resultado: PlaceResult) {
    setPartida({ latitude: resultado.latitude, longitude: resultado.longitude });
    if (!nomePartida.trim()) setNomePartida(resultado.name);
    setResultados(null);
    mudou();
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

  function publicar() {
    if (!partida || consumoCl === null || precoMilesimas === null || !escolhida || !jogo) return;
    if (nomeLimpo.length < 2) {
      Alert.alert(
        'Falta o ponto de encontro',
        'Diz onde apanhas a malta (ex.: Estação de Coimbra-B).'
      );
      return;
    }
    if (semTempo) {
      Alert.alert(
        'Já não dá',
        `As boleias têm de ser publicadas pelo menos ${CRIAR_HORAS_ANTES} h antes da saída.`
      );
      return;
    }
    // Nothing is published before the driver goes through the commitment screen.
    setCompromisso(true);
  }

  async function criar() {
    if (!partida || consumoCl === null || precoMilesimas === null || !escolhida || !jogo) return;
    // The driver must hear about seat requests the moment they arrive.
    void ativarNotificacoesDeBoleias().catch(() => undefined);
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
        parkingSpotId: parqueId,
        acceptedRules: true,
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
            // Portugal until the driver's location (or a search) arrives.
            initialRegion={{
              latitude: 39.6,
              longitude: -8.0,
              latitudeDelta: 6,
              longitudeDelta: 6,
            }}
            onMapReady={() => setMapaPronto(true)}
            showsUserLocation={aquiEstou !== null}
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
        <View style={styles.pesquisa}>
          <View style={styles.flex}>
            <Campo
              label="Procurar rua ou sítio"
              value={pesquisa}
              onChangeText={setPesquisa}
              placeholder="Ex.: Estação de Coimbra-B"
              returnKeyType="search"
              onSubmitEditing={() => void procurar()}
              maxLength={120}
            />
          </View>
        </View>
        <Button
          label={aProcurar ? 'A procurar…' : 'Procurar'}
          variant="secondary"
          icon={icons.rota}
          disabled={aProcurar || pesquisa.trim().length < 3}
          onPress={() => void procurar()}
        />
        {resultados ? (
          resultados.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Não encontrámos nada com esse nome. Experimenta a rua e a cidade.
            </ThemedText>
          ) : (
            <View style={styles.resultados}>
              {resultados.map((resultado) => (
                <Pressable
                  key={`${resultado.latitude},${resultado.longitude}`}
                  onPress={() => escolherResultado(resultado)}
                  accessibilityRole="button"
                  accessibilityLabel={`${resultado.name}, ${resultado.detail}`}
                  style={({ pressed }) => [
                    styles.resultado,
                    { borderColor: theme.border },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText style={styles.rotulo} numberOfLines={1}>
                    {resultado.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {[
                      resultado.detail,
                      resultado.distanceM !== null
                        ? `a ${formatarDistancia(resultado.distanceM)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )
        ) : null}
        {aquiEstou ? (
          <LinkTexto
            label="Usar a minha localização"
            onPress={() => {
              setPartida(aquiEstou);
              mudou();
            }}
          />
        ) : localizacaoNegada ? (
          <ThemedText type="small" themeColor="textSecondary">
            Sem acesso à localização: procura a rua ou toca no mapa.
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textMuted">
          Toca no mapa ou arrasta o pino para acertar. Escolhe um sítio público (uma estação, uma
          bomba de gasolina), nunca a tua casa.
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
          {horasPossiveis.map((horas) => (
            <Chip
              key={horas}
              label={`${horas} h`}
              selected={horas === horasEfetivas}
              emCartao
              onPress={() => setHorasAntes(horas)}
            />
          ))}
        </View>
        {semTempo ? (
          <ThemedText type="small" themeColor="textSecondary">
            {`Já não dá para oferecer boleia para este jogo: tem de ser publicada pelo menos ${CRIAR_HORAS_ANTES} h antes da saída.`}
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {`Sais ${formatarDiaEHora(saida).toLowerCase()}${jogo.horaConfirmada ? '' : ' (a hora do jogo ainda está por definir)'}. Os pedidos fecham 2 h antes.`}
          </ThemedText>
        )}
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

      <SectionHeader title="Onde deixamos o carro" />
      <Card style={styles.grupo}>
        {parquesDoEstadio.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Ainda não temos parques verificados perto deste estádio. Combina com a malta no ponto de
            encontro.
          </ThemedText>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Parques verificados perto do estádio. Quem vai contigo vê onde deixam o carro.
            </ThemedText>
            <View style={styles.chips}>
              <Chip
                label="Ainda não sei"
                selected={parqueId === null}
                emCartao
                onPress={() => setParqueId(null)}
              />
              {parquesDoEstadio.map((parque) => (
                <Chip
                  key={parque.id}
                  label={
                    parque.distanceM !== null
                      ? `${parque.name} · ${formatarDistancia(parque.distanceM)}`
                      : parque.name
                  }
                  selected={parqueId === parque.id}
                  emCartao
                  onPress={() => setParqueId(parque.id)}
                />
              ))}
            </View>
          </>
        )}
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
            onPress={publicar}
          />
          <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
            Percursos: © contribuidores do OpenStreetMap, Valhalla (FOSSGIS)
          </ThemedText>
        </>
      ) : null}
      <CompromissoBoleia
        visivel={compromisso}
        papel="condutor"
        onFechar={() => setCompromisso(false)}
        onAceitar={() => {
          setCompromisso(false);
          void criar();
        }}
      />
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
  pesquisa: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  resultados: {
    gap: Spacing.one,
  },
  resultado: {
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  pressed: {
    opacity: 0.7,
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
