import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import MapView, {
  Circle,
  MapMarker,
  Polyline,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';
import Animated, {
  FadeInDown,
  FadeOutDown,
  useReducedMotion,
  ZoomIn,
} from 'react-native-reanimated';

import { COR_ZONA_A_EVITAR } from '@/components/cuidados-visitantes';
import { CarrosselLocais } from '@/components/carrossel-locais';
import { corFacilidade, LegendaFacilidade } from '@/components/facilidade-parque';
import { WcDetalhes } from '@/components/wc-detalhes';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { fetchStadiumParking, type ParkingSpot } from '@/features/parking/api';
import { getCurrentPosition } from '@/features/presence/location';
import {
  fetchHomeFanStreets,
  fetchHomeFanZones,
  HomeFanReportRefused,
  reportHomeFans,
} from '@/features/safety/api';
import { useRestroomsNear } from '@/features/restrooms/hooks/useRestrooms';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { abrirDirecoes } from '@/lib/direcoes';
import { casasDeBanhoPerto } from '@/lib/casas-de-banho';
import { eJogoGrande } from '@/lib/classicos';
import { facilidadeEstacionamento } from '@/lib/facilidade-estacionamento';
import { plural } from '@/lib/formatos';
import { filtrarPorTempoAPe, MAX_MINUTOS_A_PE } from '@/lib/locais';
import { casasDeBanho } from '@/mocks/casas-de-banho';
import { useUserId } from '@/lib/session';
import { useAppState } from '@/state/app-state';
import { obterClube } from '@/mocks/clubes';
import { locaisDoEstadio } from '@/mocks/locais';
import type { Coordenadas, Jogo, Local, Restroom, Venue } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Escudo } from '@/ui/escudo';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** Duração máxima de qualquer animação da app. */
const DURACAO_MS = 400;
/** Intervalo entre a entrada de cada ponto, para não aparecerem todos de uma vez. */
const INTERVALO_PONTOS_MS = 60;
const ATRASO_PRIMEIRO_PONTO_MS = 150;
const DELTA_CIDADE = 0.12;
const DELTA_ESTADIO = 0.02;
const COR_ADEPTOS_DA_CASA = '#E8590C';
/** Blue square with a P, like road signs for car parks. */
const COR_ESTACIONAMENTO = '#1F5BB5';

type WcPerto = { wc: Restroom; metros: number; minutos: number };

type ParquePerto = { parque: ParkingSpot; coordenadas: Coordenadas };

type Ponto =
  { tipo: 'local'; local: Local } | ({ tipo: 'wc' } & WcPerto) | ({ tipo: 'parque' } & ParquePerto);

type Selecao = { tipo: 'local' | 'wc' | 'parque'; id: string };

const HORA_MS = 60 * 60 * 1000;
const DETOUR_FACTOR = 1.3;
const METROS_POR_MINUTO = 80;
/** Radius drawn for a cell flagged by fans (the cells are ~150 m). */
const RAIO_ZONA_ADEPTOS_M = 110;
/** Researched home-fan ground, darker than the flags fans raise during the game. */
const COR_ADEPTOS_PESQUISA = '#A34509';

function regiao(coordenadas: Coordenadas, delta: number): Region {
  return { ...coordenadas, latitudeDelta: delta, longitudeDelta: delta };
}

/**
 * Marcadores personalizados só redesenham com `tracksViewChanges`, que custa performance.
 * Fica ligado enquanto a animação corre e desliga-se logo a seguir.
 */
function useRedesenhoTemporario(chave: string) {
  const [concluida, setConcluida] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setConcluida(chave), DURACAO_MS + 100);
    return () => clearTimeout(timeout);
  }, [chave]);

  return concluida !== chave;
}

type PontoMapaProps = {
  id: string;
  coordenadas: Coordenadas;
  selecionado: boolean;
  animar: boolean;
  accessibilityLabel: string;
  onPress: () => void;
  children: (tamanho: number) => ReactNode;
};

function PontoMapa({
  id,
  coordenadas,
  selecionado,
  animar,
  accessibilityLabel,
  onPress,
  children,
}: PontoMapaProps) {
  const aRedesenhar = useRedesenhoTemporario(`${id}-${selecionado}`);

  return (
    <MapMarker
      identifier={id}
      coordinate={coordenadas}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={aRedesenhar}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}>
      <View style={styles.pontoArea}>
        <Animated.View entering={animar ? ZoomIn.duration(250) : undefined}>
          {children(selecionado ? 26 : 18)}
        </Animated.View>
      </View>
    </MapMarker>
  );
}

function CartaoMapa({
  animar,
  onFechar,
  children,
}: {
  animar: boolean;
  onFechar: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={animar ? FadeInDown.duration(DURACAO_MS) : undefined}
      exiting={animar ? FadeOutDown.duration(200) : undefined}
      style={styles.cartaoPosicao}>
      <View style={[styles.cartao, { backgroundColor: theme.backgroundElement }]}>
        <Pressable
          onPress={onFechar}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          style={({ pressed }) => [
            styles.fechar,
            { backgroundColor: theme.backgroundSelected },
            pressed && styles.pressed,
          ]}>
          <Icon name={icons.fechar} size={14} color={theme.textSecondary} strokeWidth={2.6} />
        </Pressable>
        {children}
      </View>
    </Animated.View>
  );
}

/** An area to avoid, drawn as a red circle. */
export type ZonaMapa = { id: string; titulo: string; centro: Coordenadas; raioM: number };

export function MapaJogo({
  venue,
  zonas = [],
  zonasCasa = [],
  inicio = 'cidade',
  jogo,
}: {
  venue: Venue;
  zonas?: readonly ZonaMapa[];
  /** Places the research names as home-fan ground: permanent, unlike the flags raised during a game. */
  zonasCasa?: readonly ZonaMapa[];
  /** 'estadio': open already zoomed on the stadium with the tascos and WC showing (Locais tab). */
  inicio?: 'cidade' | 'estadio';
  /** The game this map is for: shows and lets fans flag where home fans are, around kick-off. */
  jogo?: { id: string; inicio: string } & Partial<Pick<Jogo, 'casaId' | 'foraId' | 'competicao'>>;
}) {
  const router = useRouter();
  const theme = useTheme();
  const reduzirMovimento = useReducedMotion();
  const mapa = useRef<MapView>(null);

  const [modo, setModo] = useState<'cidade' | 'estadio'>(inicio);
  const [pontosVisiveis, setPontosVisiveis] = useState(0);
  const [selecao, setSelecao] = useState<Selecao | null>(null);

  const clube = obterClube(venue.clubeId);
  const { perto } = filtrarPorTempoAPe(locaisDoEstadio(venue.id));
  // Sample restrooms in demo mode; real ones (OpenStreetMap) otherwise.
  const { modoDemo, pessoasAqui } = useAppState();
  const wcsReais = useRestroomsNear(venue.id, !modoDemo);
  const wcsPerto: WcPerto[] = casasDeBanhoPerto(
    venue.coordenadas,
    modoDemo ? casasDeBanho : (wcsReais.data ?? [])
  );
  const userId = useUserId();
  const parquesDados = useQuery({
    queryKey: ['parking', venue.id],
    queryFn: modoDemo ? skipToken : () => fetchStadiumParking(venue.id),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const parquesNoMapa: ParquePerto[] = (parquesDados.data?.spots ?? []).flatMap((parque) =>
    parque.location ? [{ parque, coordenadas: parque.location }] : []
  );
  // Big games fill everything near the ground earlier, so the colours change with the game.
  const jogoGrande =
    jogo?.casaId && jogo.foraId && jogo.competicao
      ? eJogoGrande({ casaId: jogo.casaId, foraId: jogo.foraId, competicao: jogo.competicao })
      : false;
  const inicioDoJogo = jogo ? Date.parse(jogo.inicio) : null;
  const agoraMs = useNow(60 * 1000);
  // Fans can flag home fans from 6 h before kick-off until 3 h after; flags show until 6 h after.
  const podeAssinalar =
    inicioDoJogo !== null &&
    agoraMs >= inicioDoJogo - 6 * HORA_MS &&
    agoraMs <= inicioDoJogo + 3 * HORA_MS;
  const zonasAdeptos = useQuery({
    queryKey: ['home-fans', jogo?.id ?? null],
    queryFn:
      jogo && inicioDoJogo !== null && agoraMs >= inicioDoJogo - 6 * HORA_MS && !modoDemo
        ? () => fetchHomeFanZones(jogo.id)
        : skipToken,
    refetchInterval: 60 * 1000,
    meta: { persist: false },
  });
  // The streets where home fans usually are: what fans flagged in earlier games at this stadium, not just today's.
  const ruasDaCasa = useQuery({
    queryKey: ['home-fan-streets', venue.id],
    queryFn: modoDemo ? skipToken : () => fetchHomeFanStreets(venue.id),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const [aAssinalar, setAAssinalar] = useState(false);

  // Primeiro os tascos, depois os WC e os parques: todos entram escalonados pela mesma ordem.
  const pontos: Ponto[] = [
    ...perto.map((local) => ({ tipo: 'local' as const, local })),
    ...wcsPerto.map((wcPerto) => ({ tipo: 'wc' as const, ...wcPerto })),
    ...parquesNoMapa.map((parquePerto) => ({ tipo: 'parque' as const, ...parquePerto })),
  ];
  const totalPontos = pontos.length;
  const localSelecionado =
    selecao?.tipo === 'local' ? perto.find((local) => local.id === selecao.id) : undefined;
  const wcSelecionado =
    selecao?.tipo === 'wc' ? wcsPerto.find(({ wc }) => wc.id === selecao.id) : undefined;
  const parqueSelecionado =
    selecao?.tipo === 'parque'
      ? parquesNoMapa.find(({ parque }) => parque.id === selecao.id)
      : undefined;
  const aRedesenharEscudo = useRedesenhoTemporario(venue.id);
  const animar = !reduzirMovimento;

  // Entrada escalonada dos pontos depois do zoom ao estádio.
  useEffect(() => {
    if (modo !== 'estadio' || !animar) return;
    const timeouts = Array.from({ length: totalPontos }, (_, indice) =>
      setTimeout(
        () => setPontosVisiveis(indice + 1),
        ATRASO_PRIMEIRO_PONTO_MS + indice * INTERVALO_PONTOS_MS
      )
    );
    return () => timeouts.forEach(clearTimeout);
  }, [modo, totalPontos, animar]);

  function aproximarDoEstadio() {
    mapa.current?.animateToRegion(
      regiao(venue.coordenadas, DELTA_ESTADIO),
      animar ? DURACAO_MS : 0
    );
    if (modo === 'estadio') return;
    setPontosVisiveis(animar ? 0 : totalPontos);
    setModo('estadio');
  }

  function voltarACidade() {
    mapa.current?.animateToRegion(regiao(venue.coordenadas, DELTA_CIDADE), animar ? DURACAO_MS : 0);
    setModo('cidade');
    setPontosVisiveis(0);
    setSelecao(null);
  }

  // Tapping a point or swiping the cards selects a tasco, and the map follows it. The cards cover the bottom of the
  // map, so the tasco is framed a little above the centre.
  function irParaLocal(localId: string) {
    setSelecao({ tipo: 'local', id: localId });
  }

  const latitudeSelecionada = localSelecionado?.coordenadas.latitude;
  const longitudeSelecionada = localSelecionado?.coordenadas.longitude;
  useEffect(() => {
    if (latitudeSelecionada === undefined || longitudeSelecionada === undefined) return;
    mapa.current?.animateToRegion(
      regiao(
        { latitude: latitudeSelecionada - DELTA_ESTADIO * 0.22, longitude: longitudeSelecionada },
        DELTA_ESTADIO
      ),
      animar ? DURACAO_MS : 0
    );
  }, [latitudeSelecionada, longitudeSelecionada, animar]);

  function tocarNoMapa(event: MapPressEvent) {
    // No Android, tocar num marcador também chega ao mapa.
    if (event.nativeEvent.action === 'marker-press') return;
    setSelecao(null);
  }

  function assinalarAdeptos() {
    if (!jogo) return;
    Alert.alert(
      'Assinalar adeptos da casa aqui?',
      'Usamos a tua localização só para marcar a zona à tua volta (cerca de 150 m). Ninguém sabe quem assinalou, e a zona só aparece quando pelo menos 3 adeptos a assinalam. Desaparece depois do jogo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Assinalar',
          onPress: () => {
            setAAssinalar(true);
            void getCurrentPosition()
              .then(async (resultado) => {
                if (resultado.status !== 'ok') {
                  Alert.alert(
                    'Sem localização',
                    'Precisamos da tua localização para marcar a zona onde estás.'
                  );
                  return;
                }
                await reportHomeFans(jogo.id, resultado.position);
                await zonasAdeptos.refetch();
                Alert.alert(
                  'Obrigado',
                  'A zona aparece no mapa quando mais adeptos confirmarem. Tem cuidado e afasta-te se for preciso.'
                );
              })
              .catch((erro: unknown) => {
                Alert.alert(
                  'Não foi possível',
                  erro instanceof HomeFanReportRefused && erro.reason === 'too_far'
                    ? 'Só dá para assinalar zonas perto deste estádio.'
                    : erro instanceof HomeFanReportRefused && erro.reason === 'rate_limited'
                      ? 'Já assinalaste várias zonas na última hora.'
                      : erro instanceof HomeFanReportRefused && erro.reason === 'outside_window'
                        ? 'Só dá para assinalar perto da hora do jogo.'
                        : 'Verifica a ligação e tenta outra vez.'
                );
              })
              .finally(() => setAAssinalar(false));
          },
        },
      ]
    );
  }

  const dica =
    modo === 'cidade'
      ? 'Toca no escudo para veres os tascos e os WC à volta do estádio.'
      : totalPontos > 0
        ? `${plural(perto.length, 'tasco', 'tascos')} e ${plural(wcsPerto.length, 'WC', 'WC')} a menos de ${MAX_MINUTOS_A_PE} min a pé. Toca num ponto para veres mais.`
        : 'Por aqui ainda não mapeámos tascos nem WC.';

  return (
    <Card style={styles.card}>
      <View style={styles.mapaArea}>
        <MapView
          ref={mapa}
          style={StyleSheet.absoluteFill}
          initialRegion={regiao(
            venue.coordenadas,
            inicio === 'estadio' ? DELTA_ESTADIO : DELTA_CIDADE
          )}
          onPress={tocarNoMapa}
          pitchEnabled={false}
          rotateEnabled={false}
          toolbarEnabled={false}
          showsPointsOfInterests={false}
          accessibilityLabel={`Mapa de ${venue.cidade} com o ${venue.nome}`}>
          <MapMarker
            identifier={venue.id}
            coordinate={venue.coordenadas}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={10}
            tracksViewChanges={aRedesenharEscudo}
            onPress={aproximarDoEstadio}
            accessibilityLabel={`Escudo do ${clube?.nomeCurto ?? 'clube da casa'}. Toca para veres os tascos e os WC à volta do estádio.`}>
            <View style={styles.escudoArea}>
              {clube ? <Escudo clube={clube} size={34} /> : <Icon name={icons.estadio} size={28} />}
            </View>
          </MapMarker>

          {(zonasAdeptos.data ?? []).map((zona) => (
            <Circle
              key={`${zona.latitude},${zona.longitude}`}
              center={{ latitude: zona.latitude, longitude: zona.longitude }}
              radius={RAIO_ZONA_ADEPTOS_M}
              strokeColor={COR_ADEPTOS_DA_CASA}
              strokeWidth={2}
              fillColor="rgba(232, 89, 12, 0.22)"
            />
          ))}

          {zonasCasa.map((zona) => (
            <Circle
              key={zona.id}
              center={zona.centro}
              radius={zona.raioM}
              strokeColor={COR_ADEPTOS_PESQUISA}
              strokeWidth={2}
              fillColor="rgba(163, 69, 9, 0.14)"
            />
          ))}

          {(ruasDaCasa.data ?? []).map((rua, indice) => (
            <Polyline
              key={`${rua.name}-${indice}`}
              coordinates={rua.path}
              strokeColor={COR_ADEPTOS_DA_CASA}
              strokeWidth={6}
              lineCap="round"
            />
          ))}

          {zonas.map((zona) => (
            <Circle
              key={zona.id}
              center={zona.centro}
              radius={zona.raioM}
              strokeColor={COR_ZONA_A_EVITAR}
              strokeWidth={2}
              fillColor="rgba(201, 42, 42, 0.18)"
            />
          ))}

          {modo === 'estadio'
            ? pontos.slice(0, pontosVisiveis).map((ponto) =>
                ponto.tipo === 'local' ? (
                  <PontoMapa
                    key={ponto.local.id}
                    id={ponto.local.id}
                    coordenadas={ponto.local.coordenadas}
                    selecionado={selecao?.tipo === 'local' && selecao.id === ponto.local.id}
                    animar={animar}
                    onPress={() => irParaLocal(ponto.local.id)}
                    accessibilityLabel={`${ponto.local.nome}${ponto.local.homeFanHeavy ? ', ponto habitual de adeptos da casa' : ''}`}>
                    {(tamanho) => (
                      <View
                        style={[
                          styles.ponto,
                          {
                            width: tamanho,
                            height: tamanho,
                            borderRadius: tamanho / 2,
                            backgroundColor: ponto.local.homeFanHeavy
                              ? COR_ADEPTOS_DA_CASA
                              : theme.accent,
                          },
                        ]}
                      />
                    )}
                  </PontoMapa>
                ) : ponto.tipo === 'parque' ? (
                  <PontoMapa
                    key={ponto.parque.id}
                    id={ponto.parque.id}
                    coordenadas={ponto.coordenadas}
                    selecionado={selecao?.tipo === 'parque' && selecao.id === ponto.parque.id}
                    animar={animar}
                    onPress={() => setSelecao({ tipo: 'parque', id: ponto.parque.id })}
                    accessibilityLabel={`Estacionamento: ${ponto.parque.name}`}>
                    {(tamanho) => (
                      <View
                        style={[
                          styles.ponto,
                          styles.pontoParque,
                          {
                            width: tamanho + 6,
                            height: tamanho + 6,
                            backgroundColor: corFacilidade(
                              theme,
                              facilidadeEstacionamento(ponto.parque, { jogoGrande }).nivel
                            ),
                          },
                        ]}>
                        <ThemedText style={[styles.letraParque, { fontSize: tamanho * 0.62 }]}>
                          P
                        </ThemedText>
                      </View>
                    )}
                  </PontoMapa>
                ) : (
                  <PontoMapa
                    key={ponto.wc.id}
                    id={ponto.wc.id}
                    coordenadas={ponto.wc.coordenadas}
                    selecionado={selecao?.tipo === 'wc' && selecao.id === ponto.wc.id}
                    animar={animar}
                    onPress={() => setSelecao({ tipo: 'wc', id: ponto.wc.id })}
                    accessibilityLabel={`${ponto.wc.nome}, a ${ponto.minutos} minutos a pé`}>
                    {(tamanho) => (
                      <View
                        style={[
                          styles.ponto,
                          styles.pontoWc,
                          { width: tamanho + 4, height: tamanho + 4, backgroundColor: theme.info },
                        ]}>
                        <Icon name={icons.wc} size={tamanho / 2} color="#FFFFFF" />
                      </View>
                    )}
                  </PontoMapa>
                )
              )
            : null}
        </MapView>

        {localSelecionado ? (
          <CarrosselLocais
            pessoasAqui={pessoasAqui}
            locais={perto}
            emFocoId={localSelecionado.id}
            onFocar={irParaLocal}
            acoes={(local) => (
              <View style={styles.acaoCarrossel}>
                <Button
                  label="Ver local"
                  icon={icons.seguinte}
                  onPress={() =>
                    router.navigate({
                      pathname: '/locais/[localId]',
                      params: { localId: local.id },
                    })
                  }
                />
              </View>
            )}
          />
        ) : null}

        {parqueSelecionado ? (
          <CartaoMapa
            key={parqueSelecionado.parque.id}
            animar={animar}
            onFechar={() => setSelecao(null)}>
            <View style={styles.cartaoTexto}>
              <ThemedText style={styles.cartaoNome} numberOfLines={2}>
                {parqueSelecionado.parque.name}
              </ThemedText>
              <ThemedText style={[styles.metaTexto, { color: theme.textSecondary }]}>
                {parqueSelecionado.parque.distanceM !== null
                  ? `Estacionamento · ${Math.round((parqueSelecionado.parque.distanceM * DETOUR_FACTOR) / METROS_POR_MINUTO)} min a pé do estádio`
                  : 'Estacionamento'}
              </ThemedText>
              {parqueSelecionado.parque.openOnMatchdays === false ? (
                <ThemedText style={[styles.metaTexto, { color: COR_ZONA_A_EVITAR }]}>
                  Fechado em dias de jogo
                </ThemedText>
              ) : parqueSelecionado.parque.priceNote ? (
                <ThemedText style={styles.metaTexto} numberOfLines={3}>
                  {parqueSelecionado.parque.priceNote}
                </ThemedText>
              ) : null}
            </View>
            <Button
              label="Como chegar de carro"
              icon={icons.carro}
              onPress={() => abrirDirecoes(parqueSelecionado.coordenadas, 'carro')}
            />
          </CartaoMapa>
        ) : null}

        {wcSelecionado ? (
          <CartaoMapa key={wcSelecionado.wc.id} animar={animar} onFechar={() => setSelecao(null)}>
            <WcDetalhes
              wc={wcSelecionado.wc}
              metros={wcSelecionado.metros}
              minutos={wcSelecionado.minutos}
            />
          </CartaoMapa>
        ) : null}
      </View>

      <View style={styles.legenda}>
        <View style={[styles.itemLegenda, { backgroundColor: theme.backgroundSelected }]}>
          <View style={[styles.pontoLegenda, { backgroundColor: theme.accent }]} />
          <ThemedText style={styles.legendaTexto}>Tasco</ThemedText>
        </View>
        <View style={[styles.itemLegenda, { backgroundColor: theme.backgroundSelected }]}>
          <View style={[styles.pontoLegenda, { backgroundColor: COR_ADEPTOS_DA_CASA }]} />
          <ThemedText style={styles.legendaTexto}>Adeptos da casa</ThemedText>
        </View>
        <View style={[styles.itemLegenda, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[styles.pontoLegenda, styles.pontoLegendaWc, { backgroundColor: theme.info }]}
          />
          <ThemedText style={styles.legendaTexto}>WC</ThemedText>
        </View>
        {parquesNoMapa.length > 0 ? (
          <View style={[styles.itemLegenda, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[
                styles.pontoLegenda,
                styles.pontoLegendaWc,
                { backgroundColor: COR_ESTACIONAMENTO },
              ]}
            />
            <ThemedText style={styles.legendaTexto}>Estacionamento</ThemedText>
          </View>
        ) : null}
        {zonasCasa.length > 0 ? (
          <View style={[styles.itemLegenda, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.pontoLegenda, { backgroundColor: COR_ADEPTOS_PESQUISA }]} />
            <ThemedText style={styles.legendaTexto}>
              Zonas conhecidas dos adeptos da casa
            </ThemedText>
          </View>
        ) : null}
        {(ruasDaCasa.data ?? []).length > 0 ? (
          <View style={[styles.itemLegenda, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.pontoLegenda, { backgroundColor: COR_ADEPTOS_DA_CASA }]} />
            <ThemedText style={styles.legendaTexto}>Ruas com adeptos da casa</ThemedText>
          </View>
        ) : null}
        {(zonasAdeptos.data ?? []).length > 0 ? (
          <View style={[styles.itemLegenda, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.pontoLegenda, { backgroundColor: 'rgba(232, 89, 12, 0.5)' }]} />
            <ThemedText style={styles.legendaTexto}>Adeptos da casa agora</ThemedText>
          </View>
        ) : null}
        {zonas.length > 0 ? (
          <View style={[styles.itemLegenda, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.pontoLegenda, { backgroundColor: COR_ZONA_A_EVITAR }]} />
            <ThemedText style={styles.legendaTexto}>Zona a evitar</ThemedText>
          </View>
        ) : null}
      </View>

      {parquesNoMapa.length > 0 ? <LegendaFacilidade /> : null}

      <ThemedText themeColor="textSecondary" style={styles.dica}>
        {dica}
      </ThemedText>

      {podeAssinalar && userId && !modoDemo ? (
        <Button
          label={aAssinalar ? 'A assinalar…' : 'Assinalar adeptos da casa aqui'}
          variant="secondary"
          icon={icons.aviso}
          disabled={aAssinalar}
          onPress={assinalarAdeptos}
        />
      ) : null}

      {modo === 'estadio' ? (
        <Button
          label="Ver a cidade"
          variant="secondary"
          icon={icons.cidade}
          onPress={voltarACidade}
        />
      ) : null}

      <ThemedText themeColor="textMuted" style={styles.nota}>
        O fundo do mapa precisa de internet. Tascos e WC do OpenStreetMap e dos adeptos.
        {(ruasDaCasa.data ?? []).length > 0
          ? ' As ruas marcadas foram assinaladas pelos adeptos em vários jogos aqui.'
          : ''}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  acaoCarrossel: {
    flex: 1,
  },
  mapaArea: {
    height: 440,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  escudoArea: {
    width: 44,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pontoArea: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ponto: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  pontoParque: {
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letraParque: {
    color: '#FFFFFF',
    fontWeight: 900,
    lineHeight: undefined,
  },
  pontoWc: {
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartaoPosicao: {
    position: 'absolute',
    left: Spacing.two,
    right: Spacing.two,
    bottom: Spacing.two,
  },
  cartao: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderCurve: 'continuous',
    ...CardShadow,
  },
  fechar: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  pressed: {
    opacity: 0.6,
  },
  cartaoTexto: {
    gap: Spacing.one,
    paddingRight: Spacing.five,
  },
  cartaoNome: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: 800,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaTexto: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 600,
  },
  medidores: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  adeptosDaCasa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legenda: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  itemLegenda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
  },
  legendaTexto: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 800,
  },
  pontoLegenda: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pontoLegendaWc: {
    borderRadius: 3,
  },
  dica: {
    fontSize: 14,
    lineHeight: 20,
  },
  nota: {
    fontSize: 12,
    lineHeight: 16,
  },
});
