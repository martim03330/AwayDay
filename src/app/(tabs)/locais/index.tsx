import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocalCard } from '@/components/local-card';
import { MapaJogo } from '@/components/mapa-jogo';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { placeCatalogQuery } from '@/features/places/hooks/usePlaceCatalog';
import { applyPlaceCatalogRows } from '@/features/places/store';
import { placePulseKey } from '@/features/presence/hooks/usePresence';
import { useBarraDeEstadoClara } from '@/hooks/use-barra-de-estado-clara';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { filtrarPorTempoAPe, MAX_MINUTOS_A_PE, ordenarTascos, valeACaminhada } from '@/lib/locais';
import { obterClube } from '@/mocks/clubes';
import { estadiosNacionais, obterEstadio } from '@/mocks/estadios';
import { locaisDoEstadio } from '@/mocks/locais';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { CabecalhoRelvado } from '@/ui/cabecalho-relvado';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Escudo } from '@/ui/escudo';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

function temLocaisPerto(estadioId: string) {
  return filtrarPorTempoAPe(locaisDoEstadio(estadioId)).perto.length > 0;
}

/** Estádios com locais perto primeiro, mantendo a ordem original. Calculado a cada render: os tascos chegam depois. */
function ordenarEstadios() {
  return [...estadiosNacionais].sort(
    (a, b) => Number(temLocaisPerto(b.id)) - Number(temLocaisPerto(a.id))
  );
}

type ChipRelvadoProps = {
  clubeId: string;
  nome: string;
  selected: boolean;
  onPress: () => void;
};

/** Club chip on the green header: yellow when selected, translucent white otherwise. */
function ChipRelvado({ clubeId, nome, selected, onPress }: ChipRelvadoProps) {
  const theme = useTheme();
  const clube = obterClube(clubeId);
  const cor = selected ? theme.highlightText : theme.accentText;

  return (
    <Pressable
      hitSlop={4}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? theme.highlight : 'rgba(255, 255, 255, 0.16)' },
        pressed && styles.pressed,
      ]}>
      {clube ? <Escudo clube={clube} size={17} /> : null}
      <ThemedText style={[styles.chipTexto, { color: cor, fontWeight: selected ? 800 : 700 }]}>
        {clube?.nomeCurto ?? nome}
      </ThemedText>
    </Pressable>
  );
}

export default function LocaisScreen() {
  useBarraDeEstadoClara();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ estadio?: string }>();
  const { clubeFavoritoId, fezCheckIn, pessoasAqui } = useAppState();

  const estadiosOrdenados = ordenarEstadios();
  const estadioComLocais = estadiosOrdenados.find((candidato) => temLocaisPerto(candidato.id));
  // Without a club, open on a stadium that already has tascos rather than an arbitrary club's.
  const estadioDoClube =
    obterClube(clubeFavoritoId)?.estadioId ?? estadioComLocais?.id ?? estadiosNacionais[0].id;
  const estadio =
    obterEstadio(params.estadio ?? estadioDoClube) ??
    obterEstadio(estadioDoClube) ??
    estadiosNacionais[0];
  const todosOsLocais = locaisDoEstadio(estadio.id);
  const { perto: pertoPorDistancia, maisLonge } = filtrarPorTempoAPe(todosOsLocais);
  // Further than the list normally goes, but worth it: confirmed by fans, or put there by one.
  const valeAPena = valeACaminhada(todosOsLocais);
  const perto = ordenarTascos(pertoPorDistancia);
  const confirmados = perto.filter((local) => local.confirmacao === 'confirmado');
  const sugestoes = perto.filter((local) => local.confirmacao === 'sugerido');
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
  // The map shows everything at a glance; the long list is there for whoever prefers it.
  const [verLista, setVerLista] = useState(false);

  function cartao(local: (typeof perto)[number]) {
    return (
      <LocalCard
        key={local.id}
        local={local}
        pessoas={pessoasAqui(local)}
        checkedIn={fezCheckIn(local.id)}
        onPress={() =>
          router.push({ pathname: '/locais/[localId]', params: { localId: local.id } })
        }
      />
    );
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
        <Button
          label={verLista ? 'Esconder a lista' : `Ver em lista (${perto.length})`}
          variant="secondary"
          icon={verLista ? icons.fechar : icons.lista}
          onPress={() => setVerLista((atual) => !atual)}
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
        {verLista ? renderLista() : null}
      </>
    );
  }

  function renderLista() {
    return (
      <>
        {confirmados.length > 0 && sugestoes.length > 0 ? (
          <SectionHeader title="Confirmados" />
        ) : null}
        {confirmados.map(cartao)}
        {sugestoes.length > 0 ? (
          <>
            <SectionHeader
              title="Sugestões por confirmar"
              trailing={plural(sugestoes.length, 'sítio', 'sítios')}
            />
            <ThemedText themeColor="textSecondary" style={styles.bancoTexto}>
              Encontrados automaticamente perto do estádio. Podem não ser tascos para dia de jogo:
              ajuda a confirmar.
            </ThemedText>
          </>
        ) : null}
        {sugestoes.map(cartao)}
        {valeAPena.length > 0 ? (
          <>
            <SectionHeader
              title="Mais longe, mas vale a caminhada"
              trailing={plural(valeAPena.length, 'sítio', 'sítios')}
            />
            <ThemedText themeColor="textSecondary" style={styles.bancoTexto}>
              {`Ficam a mais de ${MAX_MINUTOS_A_PE} min a pé, mas estão confirmados ou foram sugeridos.`}
            </ThemedText>
            {valeAPena.map(cartao)}
          </>
        ) : null}
        {maisLonge - valeAPena.length > 0 ? (
          <View style={[styles.banco, { borderColor: theme.borderStrong }]}>
            <Icon name={icons.aPe} size={18} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.bancoTexto}>
              {maisLonge - valeAPena.length === 1
                ? `1 tasco fica a mais de ${MAX_MINUTOS_A_PE} min a pé e ainda ninguém o recomendou.`
                : `${maisLonge - valeAPena.length} tascos ficam a mais de ${MAX_MINUTOS_A_PE} min a pé e ainda ninguém os recomendou.`}
            </ThemedText>
          </View>
        ) : null}
      </>
    );
  }

  return (
    <ScrollView
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
      <CabecalhoRelvado title="Locais" eyebrow={`Tascos a menos de ${MAX_MINUTOS_A_PE} min a pé`}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}>
          {estadiosOrdenados.map((opcao) => (
            <ChipRelvado
              key={opcao.id}
              clubeId={opcao.clubeId}
              nome={opcao.nome}
              selected={opcao.id === estadio.id}
              onPress={() => router.setParams({ estadio: opcao.id })}
            />
          ))}
        </ScrollView>
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
  );
}

const styles = StyleSheet.create({
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
  chipsScroll: {
    marginHorizontal: -20,
  },
  chips: {
    gap: Spacing.two,
    paddingHorizontal: 20,
  },
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: Radius.pill,
  },
  chipTexto: {
    fontSize: 14,
    lineHeight: 19,
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
