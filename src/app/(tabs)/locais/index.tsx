import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapaJogo } from '@/components/mapa-jogo';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { placeCatalogQuery } from '@/features/places/hooks/usePlaceCatalog';
import { applyPlaceCatalogRows } from '@/features/places/store';
import { placePulseKey } from '@/features/presence/hooks/usePresence';
import { useBarraDeEstadoClara } from '@/hooks/use-barra-de-estado-clara';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { estadiosParaEscolha, tascosDoEstadio, temLocaisPerto } from '@/lib/estadios-dos-locais';
import { MAX_MINUTOS_A_PE } from '@/lib/locais';
import { obterClube } from '@/mocks/clubes';
import { estadiosNacionais, obterEstadio } from '@/mocks/estadios';
import type { Venue } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { CabecalhoRelvado } from '@/ui/cabecalho-relvado';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Escudo } from '@/ui/escudo';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';
import { useVoltarAoTopo } from '@/ui/voltar-ao-topo';

/**
 * The club picker on the green header: the chosen club's crest and name, opening a sheet with every club (the fan's
 * first). It replaced a sideways strip of chips, where the fan's own club could be far off to the right.
 */
function EscolhaDoClube({ estadio, onPress }: { estadio: Venue; onPress: () => void }) {
  const theme = useTheme();
  const clube = obterClube(estadio.clubeId);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${clube?.nomeCurto ?? estadio.nome}. Toca para escolher outro clube.`}
      style={({ pressed }) => [styles.escolha, { backgroundColor: theme.highlight }, pressed && styles.pressed]}>
      {clube ? <Escudo clube={clube} size={22} /> : null}
      <ThemedText style={[styles.escolhaTexto, { color: theme.highlightText }]} numberOfLines={1}>
        {clube?.nomeCurto ?? estadio.nome}
      </ThemedText>
      <Icon name={icons.abaixo} size={18} color={theme.highlightText} strokeWidth={2.5} />
    </Pressable>
  );
}

export default function LocaisScreen() {
  const { ref: paginaRef, onScroll, scrollEventThrottle, botao: voltarAoTopo } = useVoltarAoTopo({
    reporNoTopo: true,
  });
  useBarraDeEstadoClara();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ estadio?: string }>();
  const { clubeFavoritoId } = useAppState();

  const estadioComLocais = estadiosParaEscolha([]).outros.find((candidato) => temLocaisPerto(candidato.id));
  // Without a club, open on a stadium that already has tascos rather than an arbitrary club's.
  const estadioDoClube =
    obterClube(clubeFavoritoId)?.estadioId ?? estadioComLocais?.id ?? estadiosNacionais[0].id;
  const estadio =
    obterEstadio(params.estadio ?? estadioDoClube) ??
    obterEstadio(estadioDoClube) ??
    estadiosNacionais[0];
  const { perto, valeAPena, maisLonge } = tascosDoEstadio(estadio.id);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Pull to refresh asks the server again: the tascos (applied now — pulling is asking for them) and how many people
   * are at each one. The spinner stays only while that is in flight; a failure keeps what is on screen.
   */
  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        queryClient
          .fetchQuery({ ...placeCatalogQuery, staleTime: 0 })
          .then((rows) => applyPlaceCatalogRows(rows)),
        queryClient.refetchQueries({ queryKey: placePulseKey, type: 'active' }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }
  function renderConteudo() {
    const estadioDaMalta = obterEstadio(estadioDoClube);
    if (perto.length === 0 && estadio.regiao === 'estrangeiro' && estadioDaMalta) {
      return (
        <EmptyState
          icon={icons.semLocais}
          title={`Não vais a ${estadio.cidade}?`}
          message={`Ainda não mapeámos tascos perto do ${estadio.nome}. Se ficas por cá, ao menos sai do sofá: vê o jogo num tasco com a malta.`}
          action={{
            label: `Ver tascos perto do ${estadioDaMalta.nome}`,
            onPress: () => router.setParams({ estadio: estadioDaMalta.id }),
          }}
        />
      );
    }

    if (perto.length === 0) {
      return (
        <EmptyState
          icon={icons.semLocais}
          title="Zona sem tasco à vista"
          message={
            maisLonge > 0
              ? `Os tascos que conhecemos ficam a mais de ${MAX_MINUTOS_A_PE} min a pé do ${estadio.nome}. Longe demais para ir a pé.`
              : `Ainda não mapeámos tascos perto do ${estadio.nome}.`
          }
          action={
            estadioComLocais && estadioComLocais.id !== estadio.id
              ? {
                  label: `Ver tascos perto do ${estadioComLocais.nome}`,
                  onPress: () => router.setParams({ estadio: estadioComLocais.id }),
                }
              : undefined
          }
        />
      );
    }

    return (
      <>
        {/* Keyed by stadium: changing club starts the map again on the new stadium. */}
        <MapaJogo key={estadio.id} venue={estadio} inicio="estadio" />
        {/* The whole list in its own page: here it made the tab endless. */}
        <Button
          label={`Ver em lista (${perto.length + valeAPena.length})`}
          variant="secondary"
          icon={icons.lista}
          onPress={() => router.push({ pathname: '/locais/lista', params: { estadio: estadio.id } })}
        />
        {/* Always in view, not at the end of the list: new tascos are how the map grows. */}
        <Card style={[styles.sugerir, { backgroundColor: theme.highlight }]}>
          <View style={styles.sugerirTopo}>
            <IconCircle name={icons.tasco} tone="neutral" />
            <View style={styles.flex}>
              <ThemedText style={[styles.sugerirTitulo, { color: theme.highlightText }]}>
                Conheces um tasco que falta?
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.highlightText }}>
                Sugere-o para a malta. Fica no mapa quando 5 adeptos confirmarem que é bom.
              </ThemedText>
            </View>
          </View>
          <Button
            label="Sugerir um tasco"
            icon={icons.checkIn}
            onPress={() =>
              router.push({ pathname: '/locais/sugerir-tasco', params: { estadioId: estadio.id } })
            }
          />
        </Card>
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={paginaRef}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: insets.bottom + BottomTabInset + Spacing.four }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            progressViewOffset={insets.top}
          />
        }>
        {/* Paints the iOS overscroll area above the header green instead of white, like the other tabs. */}
        <View style={[styles.relvadoAcima, { backgroundColor: theme.accent }]} pointerEvents="none" />
        <CabecalhoRelvado title="Locais" eyebrow={`Tascos a menos de ${MAX_MINUTOS_A_PE} min a pé`}>
          <EscolhaDoClube
            estadio={estadio}
            onPress={() => router.push({ pathname: '/locais/escolher-estadio', params: { atual: estadio.id } })}
          />
        </CabecalhoRelvado>

        <View style={styles.conteudo}>
          <View style={styles.cabecalho}>
            <IconCircle name={icons.estadio} size={21} />
            <View style={styles.flex}>
              <ThemedText type="section" style={styles.estadioNome}>
                {estadio.nome}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {`${plural(perto.length, 'local', 'locais')} a menos de ${MAX_MINUTOS_A_PE} min a pé · ${estadio.cidade}`}
              </ThemedText>
            </View>
          </View>

          {renderConteudo()}
        </View>
      </ScrollView>
      {voltarAoTopo}
    </View>
  );
}

const styles = StyleSheet.create({
  relvadoAcima: {
    position: 'absolute',
    top: -1000,
    left: 0,
    right: 0,
    height: 1000,
  },
  sugerir: {
    gap: Spacing.twoAndHalf,
  },
  sugerirTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
  },
  sugerirTitulo: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 800,
  },
  escolha: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: Radius.pill,
  },
  escolhaTexto: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 800,
  },
  pressed: {
    opacity: 0.7,
  },
  conteudo: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  estadioNome: {
    fontSize: 26,
    lineHeight: 29,
  },
  banco: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  bancoTexto: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 600,
  },
});
