import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { MapMarker, type MapPressEvent, type Region } from 'react-native-maps';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { WcDetalhes } from '@/components/wc-detalhes';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { casasDeBanhoPerto } from '@/lib/casas-de-banho';
import { formatarDistancia, plural } from '@/lib/formatos';
import { filtrarPorTempoAPe, MAX_MINUTOS_A_PE } from '@/lib/locais';
import { casasDeBanho } from '@/mocks/casas-de-banho';
import { useAppState } from '@/state/app-state';
import { obterClube } from '@/mocks/clubes';
import { locaisDoEstadio, nomesTipoLocal } from '@/mocks/locais';
import type { Coordenadas, Local, Restroom, Venue } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Escudo } from '@/ui/escudo';
import { Icon, icons } from '@/ui/icon';
import { Medidor } from '@/ui/medidor';
import { ThemedText } from '@/ui/themed-text';

/** Duração máxima de qualquer animação da app. */
const DURACAO_MS = 400;
/** Intervalo entre a entrada de cada ponto, para não aparecerem todos de uma vez. */
const INTERVALO_PONTOS_MS = 60;
const ATRASO_PRIMEIRO_PONTO_MS = 150;
const DELTA_CIDADE = 0.12;
const DELTA_ESTADIO = 0.02;
const COR_ADEPTOS_DA_CASA = '#E8590C';


type WcPerto = { wc: Restroom; metros: number; minutos: number };

type Ponto = { tipo: 'local'; local: Local } | ({ tipo: 'wc' } & WcPerto);

type Selecao = { tipo: 'local' | 'wc'; id: string };

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

function ConteudoLocal({ local, onVerLocal }: { local: Local; onVerLocal: () => void }) {
  const theme = useTheme();

  return (
    <>
      <View style={styles.cartaoTexto}>
        <ThemedText style={styles.cartaoNome} numberOfLines={1}>
          {local.nome}
        </ThemedText>
        <View style={styles.meta}>
          <ThemedText style={[styles.metaTexto, { color: theme.textSecondary }]}>
            {`${nomesTipoLocal[local.tipo]} ·`}
          </ThemedText>
          <Icon name={icons.aPe} size={15} color={theme.textSecondary} />
          <ThemedText style={[styles.metaTexto, { color: theme.textSecondary }]} numberOfLines={1}>
            {`${local.minutosAPe} min a pé (${formatarDistancia(local.distanciaMetros)})`}
          </ThemedText>
        </View>
      </View>

      <View style={styles.medidores}>
        <Medidor
          compact
          label="Cervejómetro"
          icon={icons.tasco}
          tone="amarelo"
          value={local.cervejometro}
        />
        <Medidor
          compact
          label="Petiscómetro"
          icon={icons.especialidade}
          tone="verde"
          value={local.petiscometro}
        />
      </View>

      {local.homeFanHeavy ? (
        <View style={styles.adeptosDaCasa}>
          <Icon name={icons.casa} size={14} color={COR_ADEPTOS_DA_CASA} />
          <ThemedText themeColor="textSecondary" style={styles.metaTexto}>
            Ponto habitual de adeptos da casa
          </ThemedText>
        </View>
      ) : null}

      <Button label="Ver local" icon={icons.seguinte} onPress={onVerLocal} />
    </>
  );
}

export function MapaJogo({ venue }: { venue: Venue }) {
  const router = useRouter();
  const theme = useTheme();
  const reduzirMovimento = useReducedMotion();
  const mapa = useRef<MapView>(null);

  const [modo, setModo] = useState<'cidade' | 'estadio'>('cidade');
  const [pontosVisiveis, setPontosVisiveis] = useState(0);
  const [selecao, setSelecao] = useState<Selecao | null>(null);

  const clube = obterClube(venue.clubeId);
  const { perto } = filtrarPorTempoAPe(locaisDoEstadio(venue.id));
  // Restroom data is illustrative: no markers outside demo mode.
  const { modoDemo } = useAppState();
  const wcsPerto: WcPerto[] = casasDeBanhoPerto(venue.coordenadas, modoDemo ? casasDeBanho : []);
  // Primeiro os tascos, depois os WC: todos entram escalonados pela mesma ordem.
  const pontos: Ponto[] = [
    ...perto.map((local) => ({ tipo: 'local' as const, local })),
    ...wcsPerto.map((wcPerto) => ({ tipo: 'wc' as const, ...wcPerto })),
  ];
  const totalPontos = pontos.length;
  const localSelecionado =
    selecao?.tipo === 'local' ? perto.find((local) => local.id === selecao.id) : undefined;
  const wcSelecionado =
    selecao?.tipo === 'wc' ? wcsPerto.find(({ wc }) => wc.id === selecao.id) : undefined;
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
    mapa.current?.animateToRegion(regiao(venue.coordenadas, DELTA_ESTADIO), animar ? DURACAO_MS : 0);
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

  function tocarNoMapa(event: MapPressEvent) {
    // No Android, tocar num marcador também chega ao mapa.
    if (event.nativeEvent.action === 'marker-press') return;
    setSelecao(null);
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
          initialRegion={regiao(venue.coordenadas, DELTA_CIDADE)}
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

          {modo === 'estadio'
            ? pontos.slice(0, pontosVisiveis).map((ponto) =>
                ponto.tipo === 'local' ? (
                  <PontoMapa
                    key={ponto.local.id}
                    id={ponto.local.id}
                    coordenadas={ponto.local.coordenadas}
                    selecionado={selecao?.tipo === 'local' && selecao.id === ponto.local.id}
                    animar={animar}
                    onPress={() => setSelecao({ tipo: 'local', id: ponto.local.id })}
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
          <CartaoMapa key={localSelecionado.id} animar={animar} onFechar={() => setSelecao(null)}>
            <ConteudoLocal
              local={localSelecionado}
              onVerLocal={() =>
                router.navigate({
                  pathname: '/locais/[localId]',
                  params: { localId: localSelecionado.id },
                })
              }
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
          <View style={[styles.pontoLegenda, styles.pontoLegendaWc, { backgroundColor: theme.info }]} />
          <ThemedText style={styles.legendaTexto}>WC</ThemedText>
        </View>
      </View>

      <ThemedText themeColor="textSecondary" style={styles.dica}>
        {dica}
      </ThemedText>

      {modo === 'estadio' ? (
        <Button label="Ver a cidade" variant="secondary" icon={icons.cidade} onPress={voltarACidade} />
      ) : null}

      <ThemedText themeColor="textMuted" style={styles.nota}>
        O fundo do mapa precisa de internet; os pontos são da demo.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  mapaArea: {
    height: 360,
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
