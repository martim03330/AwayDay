import { skipToken, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Switch, View, type TextInput } from 'react-native';
import MapView, { MapMarker } from 'react-native-maps';

import { CompromissoBoleia } from '@/components/compromisso-boleia';
import { EscolherParque } from '@/components/escolher-parque';
import { Radius, Spacing } from '@/constants/theme';
import { fetchStadiumParking } from '@/features/parking/api';
import { getCurrentPosition } from '@/features/presence/location';
import {
  createRide,
  fetchReputation,
  setRideGroup,
  setRideVisibility,
  quoteRide,
  fetchFuelPrices,
  RideRefused,
  type RideQuote,
  type RouteOption,
} from '@/features/rides/api';
import { fetchMyGroups } from '@/features/groups/api';
import { useRefreshRides, useRideBoard } from '@/features/rides/hooks/useRides';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarData, formatarDia, formatarHora } from '@/lib/datas';
import { minutosAPe, minutosExtraDoParque } from '@/lib/facilidade-estacionamento';
import { formatarDistancia } from '@/lib/formatos';
import { PlaceSearchRefused, searchPlace, type PlaceResult } from '@/lib/procurar-sitios';
import { eJogoGrande } from '@/lib/classicos';
import {
  ajustarSaida,
  limitarSaida,
  limitesDaSaida,
  margemMinutos,
  saidaApertada,
  saidaSugerida,
} from '@/lib/hora-saida';
import { CRIAR_HORAS_ANTES } from '@/lib/regras-boleia';
import { ativarNotificacoesDeBoleias } from '@/lib/push';
import { useUserId } from '@/lib/session';
import { usePlanosJogos } from '@/state/planos-jogos';
import { avisoDeBoleiaNaIlha, avisoDeBoleiaPelaRegiao, partidaNaIlha } from '@/lib/voos';
import { vibrarErro, vibrarSucesso } from '@/lib/vibrar';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import type { Coordenadas } from '@/mocks/tipos';
import { Aviso } from '@/ui/aviso';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';
import { Expansor } from '@/ui/expansor';
import { useFormatarDinheiro } from '@/ui/valor';

/**
 * Fallback prices only, for when DGEG's daily average cannot be had (it normally comes from the server, see
 * fetchFuelPrices). The driver can always set what they paid.
 */
const COMBUSTIVEIS = [
  { id: 'gasolina', nome: 'Gasolina 95', milesimas: 2072 },
  { id: 'gasoleo', nome: 'Gasóleo', milesimas: 2152 },
] as const;
type Energia = (typeof COMBUSTIVEIS)[number]['id'] | 'eletrico';
const LUGARES = [1, 2, 3, 4, 5, 6, 7] as const;
const DELTA = 0.05;

const OPCOES: Record<RouteOption, { titulo: string; descricao: string }> = {
  rapida: { titulo: 'Mais rápido', descricao: 'Pelo caminho mais curto em tempo, com portagens.' },
  equilibrio: {
    titulo: 'Menos portagens',
    descricao: 'Autoestrada só numa parte do caminho: mais barato, sem perder muito tempo.',
  },
  sem_portagens: { titulo: 'Sem portagens', descricao: 'Evita todas as portagens que pode.' },
};

/** "6,5" -> 650 centilitres per 100 km, with integer maths; `null` when it is not a plausible consumption. */
function lerConsumo(texto: string) {
  const partes = /^(\d{1,2})(?:[.,](\d))?$/.exec(texto.trim());
  if (!partes) return null;
  const centilitros = Number(partes[1]) * 100 + Number(partes[2] ?? '0') * 10;
  return centilitros >= 300 && centilitros <= 1500 ? centilitros : null;
}

/** "2,072" -> 2072 thousandths of a euro per litre; `null` outside 0,500–4,000 €. */
function lerPrecoLitro(texto: string) {
  const partes = /^(\d)(?:[.,](\d{1,3}))?$/.exec(texto.trim().replace(/\s*€$/, ''));
  if (!partes) return null;
  const milesimas = Number(partes[1]) * 1000 + Number((partes[2] ?? '').padEnd(3, '0') || '0');
  return milesimas >= 1000 && milesimas <= 2600 ? milesimas : null;
}

/** 2072 -> "2,072", with integer maths. */
function milesimasEmTexto(milesimas: number) {
  return `${Math.floor(milesimas / 1000)},${String(milesimas % 1000).padStart(3, '0')}`;
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
    case 'already_going':
      return 'Já tens lugar, ou pediste lugar, noutra boleia para este jogo. Sai dela antes de ofereceres a tua.';
    case 'suspended':
      return 'Estás suspenso das boleias por faltas.';
    case 'rules_not_accepted':
      return 'Tens de aceitar as regras das boleias para publicar.';
    case 'bad_parking':
      return 'Esse parque não é deste estádio. Escolhe outro.';
    case 'cost_failed':
      return 'Não deu para calcular o preço deste percurso. Tenta outra vez ou muda o ponto de partida.';
    default:
      return 'Não deu para concluir. Tenta outra vez.';
  }
}

/**
 * Um passo de quinze minutos na hora de saída.
 *
 * Não é um `Button` porque um botão a sério tem 24 de espaço de cada lado: dentro de um terço do ecrã, o «−15 min»
 * partia-se em duas linhas e a fila ficava com ar de coluna.
 */
function PassoDeQuarto({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.passo,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.passoPressionado,
        disabled && styles.passoDesligado,
      ]}>
      <ThemedText style={styles.passoTexto} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/**
 * A driver offers seats for a game: meeting point, time and seats first; the car, the car park, the return and a note
 * folded under "Mais opções"; then a route with its cost.
 */
export default function OferecerBoleiaScreen() {
  const dinheiro = useFormatarDinheiro();
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const { garantirVou } = usePlanosJogos();
  const atualizar = useRefreshRides();
  const mapa = useRef<MapView>(null);
  // `grupoId` vem de um plano: a boleia já nasce do grupo, e o plano apanha-a sozinho.
  const { jogoId, grupoId: grupoDoPlano } = useLocalSearchParams<{
    jogoId: string;
    grupoId?: string;
  }>();
  const jogo = jogoId ? obterJogo(jogoId) : undefined;
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;

  const [partida, setPartida] = useState<Coordenadas | null>(null);
  const [nomePartida, setNomePartida] = useState('');
  // A departure the driver set by hand; `null` follows the suggestion.
  const [saidaManual, setSaidaManual] = useState<Date | null>(null);
  const [lugares, setLugares] = useState<(typeof LUGARES)[number]>(3);
  const [consumo, setConsumo] = useState('6,5');
  const campoPrecoLitro = useRef<TextInput>(null);
  const [combustivel, setCombustivel] = useState<Energia>('gasolina');
  // What the driver typed as the price per litre; until then it is DGEG's daily average (or the fallback).
  const [precoEscrito, setPrecoEscrito] = useState<string | null>(null);
  const precosDgeg = useQuery({
    queryKey: ['rides', 'fuel-prices'],
    queryFn: fetchFuelPrices,
    staleTime: 60 * 60 * 1000,
  });
  const eletrico = combustivel === 'eletrico';
  const precoDgeg = combustivel === 'eletrico' ? null : (precosDgeg.data?.[combustivel] ?? null);
  const precoDeReferencia =
    precoDgeg?.milliPerLitre ??
    COMBUSTIVEIS.find((opcao) => opcao.id === combustivel)?.milesimas ??
    COMBUSTIVEIS[0].milesimas;
  const precoLitro = precoEscrito ?? milesimasEmTexto(precoDeReferencia);
  const [idaEVolta, setIdaEVolta] = useState(true);
  // A seat home for whoever is left at the stadium: only makes sense when the driver is coming back anyway.
  const [aceitaVolta, setAceitaVolta] = useState(true);
  // Uma boleia pode ser «a boleia do grupo»: aparece lá dentro e fica no histórico do grupo.
  const [grupoId, setGrupoId] = useState<string | null>(grupoDoPlano ?? null);
  // Começa privada: a malta do grupo primeiro, e abre-se a toda a gente se o carro não encher.
  const [soParaOGrupo, setSoParaOGrupo] = useState(true);
  const [nota, setNota] = useState('');
  const [cotacoes, setCotacoes] = useState<RideQuote[] | null>(null);
  const [escolhida, setEscolhida] = useState<RouteOption | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const [aquiEstou, setAquiEstou] = useState<Coordenadas | null>(null);
  const [estadoLocalizacao, setEstadoLocalizacao] = useState<
    'a-procurar' | 'ok' | 'negada' | 'indisponivel'
  >('a-procurar');
  const [mapaPronto, setMapaPronto] = useState(false);
  const [pesquisa, setPesquisa] = useState('');
  const [resultados, setResultados] = useState<PlaceResult[] | null>(null);
  const [aProcurar, setAProcurar] = useState(false);
  const [compromisso, setCompromisso] = useState(false);
  const [parqueId, setParqueId] = useState<string | null>(null);
  // Folded by default: the form shows the essentials, the rest has sensible defaults.
  const [verOpcoes, setVerOpcoes] = useState(false);
  const [verPorque, setVerPorque] = useState(false);
  const [verPartilhas, setVerPartilhas] = useState(false);
  const agora = useNow(60 * 1000);
  const quadro = useRideBoard(jogo?.id ?? null, userId !== null);
  const meusGrupos = useQuery({
    queryKey: ['groups', userId],
    queryFn: userId ? fetchMyGroups : skipToken,
    meta: { persist: false },
  });
  const nomeDoGrupoDoPlano = (meusGrupos.data ?? []).find((grupo) => grupo.id === grupoDoPlano)?.name ?? null;
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

  // The ride starts near the driver, not near the stadium: find where they are, when they allow it. The map centres
  // there but the pin is not dropped on it: the start point is shown to every fan of the game, and where the driver
  // is right now is often their home.
  useEffect(() => {
    let ativo = true;
    void getCurrentPosition().then((resultado) => {
      if (!ativo) return;
      if (resultado.status !== 'ok') {
        setEstadoLocalizacao(resultado.status === 'denied' ? 'negada' : 'indisponivel');
        return;
      }
      const aqui = {
        latitude: resultado.position.latitude,
        longitude: resultado.position.longitude,
      };
      setAquiEstou(aqui);
      setEstadoLocalizacao('ok');
    });
    return () => {
      ativo = false;
    };
  }, []);

  // The map only moves once it is ready; before that, a move is silently lost.
  const latitudePartida = partida?.latitude ?? aquiEstou?.latitude;
  const longitudePartida = partida?.longitude ?? aquiEstou?.longitude;
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

  // An electric car shares only the tolls: the server ignores consumption and price, sent as 0.
  const consumoCl = eletrico ? 0 : lerConsumo(consumo);
  const precoMilesimas = eletrico ? 0 : lerPrecoLitro(precoLitro);
  // The window the server accepts: published 3 h before, at most 3 days before, 30 min before kick-off at the latest.
  const limites = limitesDaSaida(jogo.inicio, agora);
  const semTempo = limites === null;
  const parquesDoEstadio = (parques.data?.spots ?? []).filter(
    (parque) => parque.openOnMatchdays !== false
  );
  const nomeLimpo = nomePartida.trim();
  // About 20 m: the pin still counts as "where you are" after a tiny drag.
  const naMinhaLocalizacao =
    aquiEstou !== null &&
    partida !== null &&
    Math.abs(aquiEstou.latitude - partida.latitude) < 0.0002 &&
    Math.abs(aquiEstou.longitude - partida.longitude) < 0.0002;
  // A game on an island: the car only makes sense on that island, so the meeting point must be there.
  const avisoIlha = estadio ? avisoDeBoleiaNaIlha(estadio.regiao) : null;
  const avisoRegiao = estadio ? avisoDeBoleiaPelaRegiao(estadio.regiao) : null;
  const foraDaIlha =
    avisoIlha !== null && partida !== null && estadio !== undefined && !partidaNaIlha(partida, estadio.coordenadas);
  const podeCotar = partida !== null && consumoCl !== null && precoMilesimas !== null && !foraDaIlha;
  const cotacao = cotacoes?.find((candidata) => candidata.option === escolhida) ?? null;
  const parqueEscolhido = parquesDoEstadio.find((parque) => parque.id === parqueId) ?? null;
  const minutosAPeDoParque = minutosAPe(parqueEscolhido?.distanceM ?? null);
  // A car park that fills early only has room for whoever gets there early: leave sooner.
  const jogoGrandeParaParque = eJogoGrande(jogo);
  const extraDoParque = parqueEscolhido
    ? minutosExtraDoParque(parqueEscolhido, { jogoGrande: jogoGrandeParaParque })
    : 0;
  const jogoGrande = eJogoGrande(jogo);
  const sugerida = saidaSugerida({
    inicio: jogo.inicio,
    duracaoS: cotacao?.durationS ?? null,
    minutosAPeDoParque,
    minutosExtraDoParque: extraDoParque,
    jogoGrande,
  });
  const saida = limites ? limitarSaida(saidaManual ?? sugerida, limites) : sugerida;
  const apertada = cotacao !== null && saidaApertada(saida, sugerida);

  function mudou() {
    // Anything that changes the cost makes the quotes stale.
    setCotacoes(null);
    setEscolhida(null);
  }

  // Asks for the position again (it may have changed, or permission may have been given since) and puts the pin there.
  function usarAMinhaLocalizacao() {
    setEstadoLocalizacao('a-procurar');
    void getCurrentPosition().then((resultado) => {
      if (resultado.status !== 'ok') {
        setEstadoLocalizacao(resultado.status === 'denied' ? 'negada' : 'indisponivel');
        return;
      }
      const aqui = {
        latitude: resultado.position.latitude,
        longitude: resultado.position.longitude,
      };
      setAquiEstou(aqui);
      setPartida(aqui);
      setEstadoLocalizacao('ok');
      mudou();
    });
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
        erro instanceof PlaceSearchRefused && erro.reason === 'rate_limited'
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
        electric: eletrico,
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
        electric: eletrico,
        consumptionClPer100Km: consumoCl,
        fuelPriceMilliPerLitre: precoMilesimas,
        roundTrip: idaEVolta,
        departureAt: saida.toISOString(),
        seatsOffered: lugares,
        routeOption: escolhida,
        note: nota.trim(),
        parkingSpotId: parqueId,
        acceptedRules: true,
        acceptsReturnRequests: idaEVolta && aceitaVolta,
      });
      // O grupo é uma etiqueta da boleia: se falhar, a boleia fica publicada na mesma e dá para escolher depois.
      if (grupoId) {
        await setRideGroup(id, grupoId).catch(() => undefined);
        if (soParaOGrupo) await setRideVisibility(id, false).catch(() => undefined);
      }
      // Oferecer boleia é ir ao jogo: o bilhete abre-se sozinho.
      await garantirVou(jogo.id).catch(() => undefined);
      await atualizar();
      vibrarSucesso();
      router.replace({ pathname: '/jogos/boleia', params: { rideId: id, jogoId: jogo.id } });
    } catch (erro) {
      vibrarErro();
      Alert.alert('Não foi possível publicar', mensagemRecusa(erro));
    } finally {
      setACarregar(false);
    }
  }

  const nomeCombustivel =
    COMBUSTIVEIS.find((opcao) => opcao.id === combustivel)?.nome ?? COMBUSTIVEIS[0].nome;
  // What "Mais opções" is set to, so the defaults are visible without opening it.
  const resumoOpcoes = [
    eletrico ? 'carro elétrico: só portagens' : `${consumo || '…'} l/100 km`,
    eletrico ? null : `${nomeCombustivel} a ${precoLitro || '…'} €`,
    parqueEscolhido ? parqueEscolhido.name : null,
    idaEVolta ? (aceitaVolta ? 'aceitas pedidos de volta' : 'sem pedidos de volta') : null,
    nota.trim() ? 'com nota' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const opcoesComErro =
    !eletrico && ((consumo !== '' && consumoCl === null) || (precoLitro !== '' && precoMilesimas === null));
  const partilhas = cotacao ? cotacao.shareCentsByPeople.slice(0, lugares + 1) : [];
  const interruptor = (valor: boolean, mudar: (valor: boolean) => void, rotulo: string) => (
    <Switch
      value={valor}
      onValueChange={mudar}
      trackColor={{ true: theme.accent, false: theme.border }}
      thumbColor={theme.accentText}
      ios_backgroundColor={theme.border}
      accessibilityLabel={rotulo}
    />
  );

  return (
    <Screen>
      {avisoRegiao ? <Aviso title={avisoRegiao.titulo} message={avisoRegiao.mensagem} icon={icons.aviao} /> : null}
      <SectionHeader title="Ponto de encontro" trailing="Toca no mapa para acertar" />
      <Card>
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
            accessibilityLabel="Mapa para escolher o ponto de encontro. Toca para pôr o pino, ou arrasta-o.">
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

        <View style={styles.localizacao}>
          {estadoLocalizacao === 'a-procurar' ? (
            <ThemedText type="small" themeColor="textSecondary">
              A procurar a tua localização…
            </ThemedText>
          ) : estadoLocalizacao === 'ok' && naMinhaLocalizacao ? (
            <Etiqueta icon={icons.aviso} label="Onde estás agora: se for a tua casa, escolhe um sítio público" tone="aviso" />
          ) : estadoLocalizacao === 'ok' && partida === null ? (
            <>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                Toca no mapa num sítio público perto de ti
              </ThemedText>
              <LinkTexto neutro label="Usar onde estou" onPress={usarAMinhaLocalizacao} />
            </>
          ) : estadoLocalizacao === 'ok' ? (
            <>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                Pino num sítio escolhido por ti
              </ThemedText>
              <LinkTexto label="Usar onde estou" onPress={usarAMinhaLocalizacao} />
            </>
          ) : estadoLocalizacao === 'negada' ? (
            <>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                Sem acesso à localização
              </ThemedText>
              <LinkTexto label="Abrir Definições" onPress={() => void Linking.openSettings()} />
              <LinkTexto neutro label="Tentar outra vez" onPress={usarAMinhaLocalizacao} />
            </>
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                Não sabemos onde estás: procura a rua ou toca no mapa
              </ThemedText>
              <LinkTexto neutro label="Tentar outra vez" onPress={usarAMinhaLocalizacao} />
            </>
          )}
        </View>

        <Campo
          label="Procurar rua ou sítio"
          value={pesquisa}
          onChangeText={setPesquisa}
          placeholder="Ex.: Estação de Coimbra-B"
          returnKeyType="search"
          onSubmitEditing={() => void procurar()}
          maxLength={120}
        />
        {pesquisa.trim().length >= 3 ? (
          <Button
            label={aProcurar ? 'A procurar…' : 'Procurar'}
            variant="secondary"
            icon={icons.rota}
            disabled={aProcurar}
            onPress={() => void procurar()}
          />
        ) : null}
        {resultados ? (
          resultados.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Nada com esse nome. Experimenta a rua e a cidade.
            </ThemedText>
          ) : (
            <View>
              {resultados.map((resultado, indice) => (
                <LinhaGrupo
                  key={`${resultado.latitude},${resultado.longitude}`}
                  onPress={() => escolherResultado(resultado)}
                  accessibilityLabel={`${resultado.name}, ${resultado.detail}`}
                  leading={<IconCircle name={icons.locais} tone="neutral" size={16} />}
                  title={resultado.name}
                  subtitle={[
                    resultado.detail,
                    resultado.distanceM !== null
                      ? `a ${formatarDistancia(resultado.distanceM)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  separador={indice < resultados.length - 1}
                />
              ))}
            </View>
          )
        ) : null}

        <Campo
          label="Nome do ponto de encontro"
          value={nomePartida}
          onChangeText={setNomePartida}
          placeholder="Ex.: Estação de Coimbra-B"
          maxLength={80}
          autoCapitalize="words"
          returnKeyType="done"
          ajuda="Um sítio público (estação, bomba de gasolina), nunca a tua casa."
        />
      </Card>

      <SectionHeader title="Quando e quantos" />
      <Card>
        <ThemedText style={styles.rotulo}>Hora de saída</ThemedText>
        {semTempo || !limites ? (
          <ThemedText type="small" themeColor="textSecondary">
            {`Já não dá: as boleias têm de ser publicadas pelo menos ${CRIAR_HORAS_ANTES} h antes da saída.`}
          </ThemedText>
        ) : (
          <>
            <View style={styles.hora}>
              <PassoDeQuarto
                label="−15 min"
                disabled={saida.getTime() <= limites.maisCedo.getTime()}
                onPress={() => setSaidaManual(ajustarSaida(saida, -1, limites))}
              />
              <View style={styles.horaCentro}>
                <ThemedText type="score" style={styles.horaValor} numberOfLines={1}>
                  {formatarHora(saida)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {formatarDia(saida, agora)}
                </ThemedText>
              </View>
              <PassoDeQuarto
                label="+15 min"
                disabled={saida.getTime() >= limites.maisTarde.getTime()}
                onPress={() => setSaidaManual(ajustarSaida(saida, 1, limites))}
              />
            </View>
            {apertada ? (
              <ThemedText type="small" style={{ color: theme.warningText }}>
                Com esta hora chegam mais em cima do apito do que sugerimos.
              </ThemedText>
            ) : null}
            <View style={styles.linhaAcoes}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {cotacao
                  ? `Sugerida: ${formatarHora(sugerida)}`
                  : 'Acertamos a hora quando vires os percursos.'}
              </ThemedText>
              {saidaManual !== null ? (
                <LinkTexto label="Usar a sugerida" onPress={() => setSaidaManual(null)} />
              ) : null}
            </View>
            <Expansor
              icon={icons.horario}
              titulo="Porquê esta hora?"
              aberto={verPorque}
              onPress={() => setVerPorque((atual) => !atual)}
            />
            {verPorque ? (
              <ThemedText type="small" themeColor="textMuted">
                {cotacao
                  ? `${duracao(cotacao.durationS)} de viagem${minutosAPeDoParque !== null ? `, ${minutosAPeDoParque} min a pé do parque` : ''}${extraDoParque > 0 ? `, mais ${extraDoParque} min porque o parque enche cedo` : ''} e ${margemMinutos(jogoGrande) >= 90 ? '1 h 30' : '1 h'} no estádio antes do apito, para o tasco e as filas${jogoGrande ? ' (jogo grande: mais trânsito)' : ''}. Os pedidos de lugar fecham 2 h antes da saída.`
                  : 'A hora acerta-se à distância, ao parque e ao tipo de jogo. Os pedidos de lugar fecham 2 h antes da saída.'}
              </ThemedText>
            ) : null}
          </>
        )}

        <View style={[styles.separador, { backgroundColor: theme.backgroundSelected }]} />
        <ThemedText style={styles.rotulo}>Lugares livres</ThemedText>
        <View style={styles.chips}>
          {LUGARES.map((numero) => (
            <Chip
              key={numero}
              label={String(numero)}
              selected={numero === lugares}
              emCartao
              accessibilityLabel={`${numero} ${numero === 1 ? 'lugar livre' : 'lugares livres'}`}
              onPress={() => setLugares(numero)}
            />
          ))}
        </View>

        <View style={[styles.separador, { backgroundColor: theme.backgroundSelected }]} />
        <LinhaGrupo
          leading={<IconCircle name={icons.rota} tone="neutral" />}
          title="Ida e volta"
          subtitle={idaEVolta ? 'Trazes a malta de volta depois do jogo' : 'Só levas a malta ao jogo'}
          trailing={interruptor(
            idaEVolta,
            (valor) => {
              setIdaEVolta(valor);
              mudou();
            },
            'Ida e volta'
          )}
        />
      </Card>

      {grupoDoPlano ? (
        // From a plan the ride is the group's: only the group, or everyone. Another group is invited from the plan
        // («Convidar malta de outro grupo»), never by making the car belong to it.
        <>
          <SectionHeader title="Quem pode pedir lugar" />
          <Card>
            <View style={styles.chips}>
              <Chip
                label={nomeDoGrupoDoPlano ? `Só a malta do «${nomeDoGrupoDoPlano}»` : 'Só a malta do grupo'}
                selected={soParaOGrupo}
                emCartao
                onPress={() => setSoParaOGrupo(true)}
              />
              <Chip
                label="Toda a gente"
                selected={!soParaOGrupo}
                emCartao
                onPress={() => setSoParaOGrupo(false)}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {soParaOGrupo
                ? 'Se o carro não encher, abres a toda a gente. Para chamar malta de outro grupo, convida-os no plano.'
                : 'Qualquer adepto deste jogo vê a boleia e pode pedir lugar.'}
            </ThemedText>
          </Card>
        </>
      ) : null}

      {!grupoDoPlano && (meusGrupos.data ?? []).length > 0 ? (
        <>
          <SectionHeader title="De quem é a boleia" />
          <Card>
            <View style={styles.chips}>
              <Chip
                label="Só minha"
                selected={grupoId === null}
                emCartao
                onPress={() => setGrupoId(null)}
              />
              {(meusGrupos.data ?? []).map((grupo) => (
                <Chip
                  key={grupo.id}
                  label={grupo.name}
                  selected={grupoId === grupo.id}
                  emCartao
                  onPress={() => setGrupoId(grupo.id)}
                />
              ))}
            </View>
            {grupoId ? (
              <LinhaGrupo
                leading={<IconCircle name={icons.perfil} />}
                title="Só para o grupo, por agora"
                subtitle={
                  soParaOGrupo
                    ? 'Se o carro não encher, abres a toda a gente'
                    : 'Qualquer adepto deste jogo a vê'
                }
                trailing={interruptor(soParaOGrupo, setSoParaOGrupo, 'Só para o grupo, por agora')}
              />
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                A boleia de um grupo aparece lá dentro e fica no histórico do grupo.
              </ThemedText>
            )}
          </Card>
        </>
      ) : null}

      <Card style={styles.linhas}>
        <LinhaGrupo
          onPress={() => setVerOpcoes((atual) => !atual)}
          accessibilityLabel={`Mais opções: ${resumoOpcoes}. Toca para ${verOpcoes ? 'esconder' : 'mudar'}.`}
          leading={<IconCircle name={icons.definicoes} tone={opcoesComErro ? 'red' : 'neutral'} />}
          title="Mais opções"
          subtitle={opcoesComErro ? 'Há um valor por corrigir' : resumoOpcoes}
          trailing={
            <View style={verOpcoes ? styles.setaAberta : undefined}>
              <Icon name={icons.seguinte} size={18} color={theme.textMuted} />
            </View>
          }
          separador={verOpcoes}
        />
        {verOpcoes ? (
          <View style={styles.opcoes}>
            <ThemedText type="eyebrow" themeColor="accentInk">
              O teu carro
            </ThemedText>
            <View style={styles.chips}>
              {[...COMBUSTIVEIS, { id: 'eletrico' as const, nome: 'Elétrico' }].map((opcao) => (
                <Chip
                  key={opcao.id}
                  label={opcao.nome}
                  selected={opcao.id === combustivel}
                  emCartao
                  onPress={() => {
                    setCombustivel(opcao.id);
                    // Another fuel: back to its average, not the price typed for the other one.
                    setPrecoEscrito(null);
                    mudou();
                  }}
                />
              ))}
            </View>
            {eletrico ? (
              <ThemedText type="small" themeColor="textSecondary">
                Num carro elétrico, a boleia divide só as portagens. O carregamento fica por tua conta.
              </ThemedText>
            ) : (
              <>
                <Campo
                  label="Consumo (litros aos 100 km)"
                  value={consumo}
                  onChangeText={(texto) => {
                    setConsumo(texto);
                    mudou();
                  }}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => campoPrecoLitro.current?.focus()}
                  erro={consumo && consumoCl === null ? 'Escreve um valor entre 3 e 15, ex.: 6,5' : null}
                />
                <Campo
                  ref={campoPrecoLitro}
                  label="Preço por litro (€)"
                  value={precoLitro}
                  onChangeText={(texto) => {
                    setPrecoEscrito(texto);
                    mudou();
                  }}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  ajuda={
                    precoDgeg && precoEscrito === null
                      ? `Preço médio em Portugal a ${formatarData(new Date(`${precoDgeg.date}T12:00:00Z`))} (DGEG). Muda se pagaste outro.`
                      : 'Põe o que pagaste da última vez que atestaste.'
                  }
                  erro={precoLitro && precoMilesimas === null ? 'Escreve um preço entre 1,000 e 2,600, ex.: 2,072' : null}
                />
              </>
            )}

            <View style={[styles.separador, { backgroundColor: theme.backgroundSelected }]} />
            <ThemedText type="eyebrow" themeColor="accentInk">
              Onde deixas o carro
            </ThemedText>
            <EscolherParque
              parques={parquesDoEstadio}
              escolhido={parqueId}
              onEscolher={setParqueId}
              jogoGrande={jogoGrande}
              inicio={jogo.inicio}
            />

            {idaEVolta ? (
              <>
                <View style={[styles.separador, { backgroundColor: theme.backgroundSelected }]} />
                <LinhaGrupo
                  leading={<IconCircle name={icons.carro} tone="sky" />}
                  title="Aceito pedidos de boleia de volta"
                  subtitle="Quem ficar sem transporte pede-te lugar; decides na hora"
                  trailing={interruptor(
                    aceitaVolta,
                    setAceitaVolta,
                    'Aceito pedidos de boleia de volta'
                  )}
                />
              </>
            ) : null}

            <View style={[styles.separador, { backgroundColor: theme.backgroundSelected }]} />
            <Campo
              label="Nota para quem vai (opcional)"
              value={nota}
              onChangeText={setNota}
              placeholder="Ex.: saio pontualmente, cabe uma mochila"
              maxLength={280}
              autoCapitalize="sentences"
              returnKeyType="done"
            />
          </View>
        ) : null}
      </Card>

      {cotacoes ? null : (
        <>
          <Button
            label={aCarregar ? 'A calcular…' : 'Ver percursos e custos'}
            icon={icons.rota}
            disabled={!podeCotar || aCarregar}
            onPress={() => void verPercursos()}
          />
          {partida === null ? (
            <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
              Põe primeiro o ponto de encontro no mapa.
            </ThemedText>
          ) : foraDaIlha ? (
            <ThemedText type="small" themeColor="dangerText" style={styles.centro}>
              Este ponto de encontro não é na ilha do estádio. Escolhe um sítio na ilha.
            </ThemedText>
          ) : null}
        </>
      )}

      {cotacoes ? (
        <>
          <SectionHeader title="Percurso e preço" />
          <Card style={styles.linhas}>
            {cotacoes.map((opcao, indice) => {
              const selecionada = opcao.option === escolhida;
              const rapida = cotacoes.find((outra) => outra.option === 'rapida');
              // Against the fastest: «poupas 9,00 € · +18 min», so the cheaper roads say what they are worth.
              const poupanca =
                rapida && opcao !== rapida && rapida.totalCents > opcao.totalCents
                  ? `poupas ${dinheiro.formatar(rapida.totalCents - opcao.totalCents)} · +${Math.max(1, Math.round((opcao.durationS - rapida.durationS) / 60))} min`
                  : null;
              return (
                <Pressable
                  key={opcao.option}
                  onPress={() => setEscolhida(opcao.option)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selecionada }}
                  accessibilityLabel={`${OPCOES[opcao.option].titulo}, ${dinheiro.dito(opcao.totalCents)}. ${OPCOES[opcao.option].descricao}`}
                  style={({ pressed }) => [
                    styles.percurso,
                    indice < cotacoes.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: theme.backgroundSelected,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: selecionada ? theme.accent : theme.borderStrong },
                      selecionada && { backgroundColor: theme.accent },
                    ]}>
                    {selecionada ? (
                      <Icon name={icons.checkInFeito} size={12} color={theme.accentText} strokeWidth={3} />
                    ) : null}
                  </View>
                  <View style={styles.flex}>
                    <ThemedText style={styles.rotulo}>{OPCOES[opcao.option].titulo}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {`${duracao(opcao.durationS)} · ${formatarDistancia(opcao.distanceM)} · ${
                        opcao.tollM === 0
                          ? 'sem portagens'
                          : opcao.motorways.length > 0
                            ? `pela ${opcao.motorways.join(' → ')}`
                            : `${formatarDistancia(opcao.tollM)} com portagem`
                      }`}
                    </ThemedText>
                    {poupanca ? (
                      <ThemedText type="smallBold" themeColor="accentInk">
                        {poupanca}
                      </ThemedText>
                    ) : null}
                    {selecionada ? (
                      <ThemedText type="small" themeColor="textMuted">
                        {`Combustível ${dinheiro.formatar(opcao.fuelCents)} · portagens ${dinheiro.formatar(opcao.tollCents)} (estimativa)`}
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText style={styles.valor}>{dinheiro.formatar(opcao.totalCents)}</ThemedText>
                </Pressable>
              );
            })}
          </Card>

          {cotacao && partilhas.length > 0 ? (
            <Card>
              <View style={styles.linhaValor}>
                <ThemedText themeColor="textSecondary" style={styles.flex}>
                  {`Cada um, com o carro cheio (${partilhas.length} pessoas)`}
                </ThemedText>
                <ThemedText style={styles.valorGrande}>
                  {dinheiro.formatar(partilhas[partilhas.length - 1])}
                </ThemedText>
              </View>
              {verPartilhas
                ? partilhas.slice(0, -1).map((valor, indice) => (
                    <View key={indice} style={styles.linhaValor}>
                      <ThemedText themeColor="textSecondary">
                        {indice === 0 ? 'Só tu' : `Tu e mais ${indice}`}
                      </ThemedText>
                      <ThemedText style={styles.valor}>{`${dinheiro.formatar(valor)} cada`}</ThemedText>
                    </View>
                  ))
                : null}
              {partilhas.length > 1 ? (
                <Expansor
                  icon={icons.perfil}
                  titulo="Quanto fica com menos gente"
                  aberto={verPartilhas}
                  onPress={() => setVerPartilhas((atual) => !atual)}
                />
              ) : null}
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
  mapaArea: {
    height: 220,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  localizacao: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 38,
  },
  rotulo: {
    fontWeight: 800,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  hora: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  passo: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.button,
    borderWidth: 1.5,
  },
  passoPressionado: {
    opacity: 0.8,
  },
  passoDesligado: {
    opacity: 0.4,
  },
  passoTexto: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  horaCentro: {
    alignItems: 'center',
    minWidth: 96,
  },
  horaValor: {
    fontVariant: ['tabular-nums'],
  },
  linhaAcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  separador: {
    height: 1,
  },
  linhas: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  opcoes: {
    gap: Spacing.twoAndHalf,
    paddingTop: Spacing.twoAndHalf,
    paddingBottom: Spacing.two,
  },
  setaAberta: {
    transform: [{ rotate: '90deg' }],
  },
  percurso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
    paddingVertical: Spacing.twoAndHalf,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  linhaValor: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  valor: {
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  valorGrande: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  flex: {
    flex: 1,
  },
  centro: {
    textAlign: 'center',
  },
});
