import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { MapMarker, type MapPressEvent, type Region } from 'react-native-maps';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarDistancia, plural } from '@/lib/formatos';
import { filtrarPorTempoAPe, MAX_MINUTOS_A_PE } from '@/lib/locais';
import { obterClube } from '@/mocks/clubes';
import { locaisDoEstadio, nomesTipoLocal } from '@/mocks/locais';
import type { Coordenadas, Local, Venue } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Escudo } from '@/ui/escudo';
import { Icon, icons } from '@/ui/icon';
import { Medidor } from '@/ui/medidor';
import { ThemedText } from '@/ui/themed-text';
import { ThemedView } from '@/ui/themed-view';

/** Duração máxima de qualquer animação da app. */
const DURACAO_MS = 400;
/** Intervalo entre a entrada de cada ponto, para não aparecerem todos de uma vez. */
const INTERVALO_PONTOS_MS = 60;
const ATRASO_PRIMEIRO_PONTO_MS = 150;
const DELTA_CIDADE = 0.12;
const DELTA_ESTADIO = 0.02;
const COR_ADEPTOS_DA_CASA = '#E8590C';

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

type PontoLocalProps = {
  local: Local;
  selecionado: boolean;
  animar: boolean;
  onPress: () => void;
};

function PontoLocal({ local, selecionado, animar, onPress }: PontoLocalProps) {
  const theme = useTheme();
  const aRedesenhar = useRedesenhoTemporario(`${local.id}-${selecionado}`);
  const tamanho = selecionado ? 26 : 18;

  return (
    <MapMarker
      identifier={local.id}
      coordinate={local.coordenadas}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={aRedesenhar}
      onPress={onPress}
      accessibilityLabel={`${local.nome}${local.homeFanHeavy ? ', ponto habitual de adeptos da casa' : ''}`}>
      <View style={styles.pontoArea}>
        <Animated.View
          entering={animar ? ZoomIn.duration(250) : undefined}
          style={[
            styles.ponto,
            {
              width: tamanho,
              height: tamanho,
              borderRadius: tamanho / 2,
              backgroundColor: local.homeFanHeavy ? COR_ADEPTOS_DA_CASA : theme.accent,
            },
          ]}
        />
      </View>
    </MapMarker>
  );
}

type CartaoLocalProps = {
  local: Local;
  animar: boolean;
  onFechar: () => void;
  onVerLocal: () => void;
};

function CartaoLocal({ local, animar, onFechar, onVerLocal }: CartaoLocalProps) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={animar ? FadeInDown.duration(DURACAO_MS) : undefined}
      exiting={animar ? FadeOutDown.duration(200) : undefined}
      style={styles.cartaoPosicao}>
      <ThemedView style={[styles.cartao, { borderColor: theme.border }]}>
        <View style={styles.cartaoTopo}>
          <View style={styles.flex}>
            <ThemedText type="smallBold" style={styles.cartaoNome} numberOfLines={1}>
              {local.nome}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {`${nomesTipoLocal[local.tipo]} · 🚶 ${local.minutosAPe} min a pé (${formatarDistancia(local.distanciaMetros)})`}
            </ThemedText>
          </View>
          <Pressable
            onPress={onFechar}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            style={({ pressed }) => pressed && styles.pressed}>
            <Icon name={icons.fechar} size={16} color={theme.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.medidores}>
          <Medidor compact label="Cervejómetro" emoji="🍺" value={local.cervejometro} />
          <Medidor compact label="Petiscómetro" emoji="🍢" value={local.petiscometro} />
        </View>

        {local.homeFanHeavy ? (
          <View style={styles.adeptosDaCasa}>
            <Icon name={icons.casa} size={13} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              Ponto habitual de adeptos da casa
            </ThemedText>
          </View>
        ) : null}

        <Button label="Ver local" icon={icons.seguinte} onPress={onVerLocal} />
      </ThemedView>
    </Animated.View>
  );
}

export function MapaJogo({ venue }: { venue: Venue }) {
  const router = useRouter();
  const theme = useTheme();
  const reduzirMovimento = useReducedMotion();
  const mapa = useRef<MapView>(null);

  const [modo, setModo] = useState<'cidade' | 'estadio'>('cidade');
  const [pontosVisiveis, setPontosVisiveis] = useState(0);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const clube = obterClube(venue.clubeId);
  const { perto } = filtrarPorTempoAPe(locaisDoEstadio(venue.id));
  const totalPerto = perto.length;
  const selecionado = perto.find((local) => local.id === selecionadoId);
  const aRedesenharEscudo = useRedesenhoTemporario(venue.id);
  const animar = !reduzirMovimento;

  // Entrada escalonada dos pontos depois do zoom ao estádio.
  useEffect(() => {
    if (modo !== 'estadio' || !animar) return;
    const timeouts = Array.from({ length: totalPerto }, (_, indice) =>
      setTimeout(
        () => setPontosVisiveis(indice + 1),
        ATRASO_PRIMEIRO_PONTO_MS + indice * INTERVALO_PONTOS_MS
      )
    );
    return () => timeouts.forEach(clearTimeout);
  }, [modo, totalPerto, animar]);

  function aproximarDoEstadio() {
    mapa.current?.animateToRegion(regiao(venue.coordenadas, DELTA_ESTADIO), animar ? DURACAO_MS : 0);
    if (modo === 'estadio') return;
    setPontosVisiveis(animar ? 0 : totalPerto);
    setModo('estadio');
  }

  function voltarACidade() {
    mapa.current?.animateToRegion(regiao(venue.coordenadas, DELTA_CIDADE), animar ? DURACAO_MS : 0);
    setModo('cidade');
    setPontosVisiveis(0);
    setSelecionadoId(null);
  }

  function tocarNoMapa(event: MapPressEvent) {
    // No Android, tocar num marcador também chega ao mapa.
    if (event.nativeEvent.action === 'marker-press') return;
    setSelecionadoId(null);
  }

  const dica =
    modo === 'cidade'
      ? 'Toca no escudo para veres os tascos à volta do estádio.'
      : totalPerto > 0
        ? `${plural(totalPerto, 'tasco', 'tascos')} a menos de ${MAX_MINUTOS_A_PE} min a pé. Toca num ponto para veres mais.`
        : 'Por aqui ainda não mapeámos tascos.';

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
            accessibilityLabel={`Escudo do ${clube?.nomeCurto ?? 'clube da casa'}. Toca para veres os tascos à volta do estádio.`}>
            <View style={styles.escudoArea}>
              {clube ? <Escudo clube={clube} size={34} /> : <Icon name={icons.estadio} size={28} />}
            </View>
          </MapMarker>

          {modo === 'estadio'
            ? perto
                .slice(0, pontosVisiveis)
                .map((local) => (
                  <PontoLocal
                    key={local.id}
                    local={local}
                    selecionado={local.id === selecionadoId}
                    animar={animar}
                    onPress={() => setSelecionadoId(local.id)}
                  />
                ))
            : null}
        </MapView>

        {selecionado ? (
          <CartaoLocal
            key={selecionado.id}
            local={selecionado}
            animar={animar}
            onFechar={() => setSelecionadoId(null)}
            onVerLocal={() =>
              router.navigate({ pathname: '/locais/[localId]', params: { localId: selecionado.id } })
            }
          />
        ) : null}
      </View>

      <View style={styles.legenda}>
        <View style={styles.itemLegenda}>
          <View style={[styles.pontoLegenda, { backgroundColor: theme.accent }]} />
          <ThemedText type="small" themeColor="textSecondary">
            Tasco
          </ThemedText>
        </View>
        <View style={styles.itemLegenda}>
          <View style={[styles.pontoLegenda, { backgroundColor: COR_ADEPTOS_DA_CASA }]} />
          <ThemedText type="small" themeColor="textSecondary">
            Adeptos da casa
          </ThemedText>
        </View>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {dica}
      </ThemedText>

      {modo === 'estadio' ? (
        <Button label="Ver a cidade" variant="secondary" icon={icons.cidade} onPress={voltarACidade} />
      ) : null}

      <ThemedText type="small" themeColor="textSecondary" style={styles.nota}>
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
    height: 340,
    borderRadius: 16,
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
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ponto: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  cartaoPosicao: {
    position: 'absolute',
    left: Spacing.two,
    right: Spacing.two,
    bottom: Spacing.two,
  },
  cartao: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cartaoTopo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  cartaoNome: {
    fontSize: 17,
    lineHeight: 24,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  medidores: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  adeptosDaCasa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legenda: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  itemLegenda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  pontoLegenda: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  nota: {
    fontSize: 12,
    lineHeight: 16,
  },
});
