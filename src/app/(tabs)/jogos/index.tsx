import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { startTransition, useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setStatusBarStyle } from 'expo-status-bar';

import { CalendarioDeJogos } from '@/components/calendario-mensal';
import { JogoCard } from '@/components/jogo-card';
import { ConvitesDeBoleia } from '@/components/convites-de-boleia';
import { SessoesAbertas } from '@/components/sessoes-abertas';
import { fixtureCatalogQuery } from '@/features/fixtures/hooks/useFixtureCatalog';
import { applyFixtureCatalogRows } from '@/features/fixtures/store';
import { useRefreshFriends } from '@/features/friends/hooks/useFriends';
import { useMyOpenTripSessions } from '@/features/trips/hooks/useTrips';
import { useMyAttendance } from '@/features/activity/hooks/useAttendance';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { AlertasBoleias } from '@/features/rides/components/AlertasBoleias';
import { useBarraDeEstadoClara } from '@/hooks/use-barra-de-estado-clara';
import { useJogosAQueFoste } from '@/hooks/use-jogos-a-que-foste';
import { useNow } from '@/hooks/use-now';
import { useEstaEscuro, useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import {
  clubesDoUtilizador,
  correspondeCompeticao,
  eJogoDosClubes,
  estadoDoJogo,
  ficaNaListaDeJogos,
  type FiltroCompeticao,
} from '@/lib/jogos';
import { useUserId } from '@/lib/session';
import {
  MOSTRAR_CLUBE_DA_TERRA,
  obterClube,
  TEXTO_SEM_JOGOS,
  temJogosNaApp,
} from '@/mocks/clubes';
import { jogos } from '@/mocks/jogos';
import type { Clube, Jogo } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { Aviso } from '@/ui/aviso';
import { CabecalhoRelvado } from '@/ui/cabecalho-relvado';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { Escudo } from '@/ui/escudo';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';
import { useVoltarAoTopo } from '@/ui/voltar-ao-topo';

const filtrosCompeticao: { id: FiltroCompeticao; label: string; emTexto: string }[] = [
  { id: 'todas', label: 'Todas', emTexto: '' },
  { id: 'liga', label: 'Liga Betclic', emTexto: ' na Liga Betclic' },
  // First version: Liga 2, Liga 3 and the cups have no fixtures yet, so their filters stay hidden.
  { id: 'europa', label: 'Europa', emTexto: ' nas competições europeias' },
];

/** Today's date for the header eyebrow ("segunda-feira, 14 de setembro"), always in Lisbon. */
const formatoHoje = new Intl.DateTimeFormat('pt-PT', {
  timeZone: 'Europe/Lisbon',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Day heading: display font on the left, game count on the right. Muted for finished games. */
function CabecalhoDia({
  titulo,
  total,
  apagado = false,
}: {
  titulo: string;
  total: number;
  apagado?: boolean;
}) {
  return (
    <View style={styles.cabecalhoDia} accessibilityRole="header">
      <ThemedText
        type="section"
        themeColor={apagado ? 'textSecondary' : 'text'}
        style={styles.tituloDia}
        numberOfLines={1}>
        {titulo}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.totalDia}>
        {plural(total, 'jogo', 'jogos')}
      </ThemedText>
    </View>
  );
}

/** The way out of "only my clubs": every other club's games, with a wink. */
function EspreitarConcorrencia({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Espreitar a concorrência. Fica entre nós, não contamos à claque."
      accessibilityHint="Mostra os jogos de todos os clubes"
      style={({ pressed }) => [
        styles.concorrencia,
        { borderColor: theme.borderStrong, backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <IconCircle name={icons.espreitar} tone="yellow" />
      <View style={styles.flex}>
        <ThemedText style={styles.concorrenciaTitulo}>Espreitar a concorrência</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Fica entre nós, não contamos à claque.
        </ThemedText>
      </View>
      <Icon name={icons.seguinte} size={18} color={theme.textMuted} />
    </Pressable>
  );
}

/** "Benfica não joga", "Benfica e SC Braga não jogam". */
function quemNaoJoga(clubes: readonly Clube[]) {
  if (clubes.length === 0) return 'Os teus clubes não jogam';
  if (clubes.length === 1) return `${clubes[0].nomeCurto} não joga`;
  return `${clubes.map((clube) => clube.nomeCurto).join(' e ')} não jogam`;
}

export default function JogosScreen() {
  const { ref: paginaRef, onScroll, scrollEventThrottle, botao: voltarAoTopo } = useVoltarAoTopo({
    reporNoTopo: true,
  });
  useBarraDeEstadoClara();
  const router = useRouter();
  const theme = useTheme();
  const escuro = useEstaEscuro();
  const insets = useSafeAreaInsets();
  const agora = useNow();
  const { clubeFavoritoId, clubeDaTerraId, avaliacaoDoJogo } = useAppState();
  const userId = useUserId();
  const sessoesAbertas = useMyOpenTripSessions(userId !== null);
  const presencas = useMyAttendance(userId);
  const boleiasComSessao = (sessoesAbertas.data ?? []).flatMap((sessao) =>
    sessao.ride ? [sessao.ride.id] : []
  );
  const { foste } = useJogosAQueFoste();
  const [competicao, setCompeticao] = useState<FiltroCompeticao>('todas');
  // Only the user's clubs by default; the rest is one (humorous) tap away.
  const [verConcorrencia, setVerConcorrencia] = useState(false);
  // Once the filters have scrolled away, a bar stays at the top with the leagues and «Esconder jogos» (testers had to
  // scroll all the way back to close a long list).
  const [yDosFiltros, setYDosFiltros] = useState(0);
  const [barraFixa, setBarraFixa] = useState(false);
  // Coming back to the tab with the bar showing: dark status bar text again (useBarraDeEstadoClara set it light).
  useFocusEffect(
    useCallback(() => {
      if (barraFixa && !escuro) setStatusBarStyle('dark', true);
    }, [barraFixa, escuro])
  );
  const queryClient = useQueryClient();
  const refrescarAmigos = useRefreshFriends();
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Pull to refresh asks the server again: the fixture catalogue (applied now — pulling is asking for it), the open
   * trips and the ride invites. The spinner stays only while that is in flight; a failure keeps what is on screen.
   */
  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        queryClient
          .fetchQuery({ ...fixtureCatalogQuery, staleTime: 0 })
          .then((rows) => applyFixtureCatalogRows(rows)),
        userId ? sessoesAbertas.refetch() : Promise.resolve(),
        userId ? refrescarAmigos() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  const idsMeusClubes = clubesDoUtilizador(
    clubeFavoritoId,
    MOSTRAR_CLUBE_DA_TERRA ? clubeDaTerraId : null
  );
  const meusClubes = idsMeusClubes
    .map((id) => obterClube(id))
    .filter((clube): clube is Clube => clube !== undefined);
  // Without a club there is nothing to filter by: every game shows, never someone else's club by default.
  const semClube = idsMeusClubes.length === 0;
  // Liga 2 and Liga 3 clubs have no fixtures in the app yet: say so and show every game instead of an empty list.
  const clubesSemJogos = meusClubes.length > 0 && !meusClubes.some(temJogosNaApp);
  const verTodos = verConcorrencia || semClube || clubesSemJogos;
  const filtrados = jogos.filter(
    (jogo) =>
      ficaNaListaDeJogos(jogo, agora, foste(jogo.id)) &&
      correspondeCompeticao(jogo, competicao) &&
      (verTodos || eJogoDosClubes(jogo, idsMeusClubes))
  );
  const proximos = filtrados.filter((jogo) => estadoDoJogo(jogo, agora) !== 'terminado');
  const terminados = filtrados
    .filter((jogo) => estadoDoJogo(jogo, agora) === 'terminado')
    .reverse();
  // The earliest game the fan marked as going to (the catalogue is sorted by kick-off).
  const hoje = formatoHoje.format(new Date(agora));

  function limparFiltros() {
    setCompeticao('todas');
  }

  function renderJogo(jogo: Jogo) {
    return (
      <JogoCard
        key={jogo.id}
        jogo={jogo}
        estado={estadoDoJogo(jogo, agora)}
        avaliacao={avaliacaoDoJogo(jogo.id)}
        onPress={() => router.push({ pathname: '/jogos/[jogoId]', params: { jogoId: jogo.id } })}
      />
    );
  }

  function renderConteudo() {
    if (filtrados.length === 0) {
      const emCompeticao =
        filtrosCompeticao.find((filtro) => filtro.id === competicao)?.emTexto ?? '';
      if (!verTodos) {
        return (
          <View style={styles.grupo}>
            <EmptyState
              icon={icons.semJogos}
              title="Jornada de descanso"
              message={`${quemNaoJoga(meusClubes)}${emCompeticao} nos próximos dias.`}
              action={
                competicao === 'todas'
                  ? undefined
                  : { label: 'Limpar filtros', onPress: limparFiltros }
              }
            />
            <EspreitarConcorrencia onPress={() => startTransition(() => setVerConcorrencia(true))} />
          </View>
        );
      }
      return (
        <EmptyState
          icon={icons.semJogos}
          title="Jornada de descanso"
          message={`Nenhum jogo${emCompeticao} nos próximos dias. Aproveita para descansar a voz.`}
          action={{ label: 'Limpar filtros', onPress: limparFiltros }}
        />
      );
    }

    return (
      <>
        {/* The days with games in a strip (the month grid is one tap away): the chosen day's games right under it. */}
        <CalendarioDeJogos
          jogos={proximos}
          agora={agora}
          renderJogo={renderJogo}
          vou={(jogoId) => presencas.data?.[jogoId] != null}
        />
        {terminados.length > 0 ? (
          <View style={styles.grupo}>
            <CabecalhoDia titulo="Jogos a que foste" total={terminados.length} apagado />
            {terminados.map(renderJogo)}
          </View>
        ) : null}
        {semClube ? (
          <LinkTexto
            label="Escolhe o teu clube para veres primeiro os jogos dele"
            onPress={() => router.push('/perfil/clube')}
          />
        ) : verConcorrencia || clubesSemJogos ? null : (
          <EspreitarConcorrencia onPress={() => startTransition(() => setVerConcorrencia(true))} />
        )}
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={paginaRef}
        onScroll={(evento) => {
          onScroll(evento);
          const fixa = yDosFiltros > 0 && evento.nativeEvent.contentOffset.y > yDosFiltros - insets.top;
          if (fixa !== barraFixa) {
            setBarraFixa(fixa);
            // Dark status bar text over the light bar; light again over the green header.
            setStatusBarStyle(fixa && !escuro ? 'dark' : 'light', true);
          }
        }}
        scrollEventThrottle={scrollEventThrottle}
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: insets.bottom + BottomTabInset + Spacing.four }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            progressViewOffset={insets.top}
            tintColor={theme.accentText}
          />
        }>
        {/* Paints the iOS overscroll area above the header green instead of whitewash. */}
        <View style={[styles.relvadoAcima, { backgroundColor: theme.accent }]} pointerEvents="none" />

        {/* No coach tip here any more: it took half the screen and made the first page noisy (owner's call). */}
        <CabecalhoRelvado title="Jogos" eyebrow={hoje} />

        <View style={styles.largura} onLayout={(evento) => setYDosFiltros(evento.nativeEvent.layout.y)}>
          <View style={styles.filtros}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentInsetAdjustmentBehavior="never"
              contentContainerStyle={styles.chips}>
              {filtrosCompeticao.map((filtro) => (
                <Chip
                  key={filtro.id}
                  label={filtro.label}
                  selected={competicao === filtro.id}
                  onPress={() => setCompeticao(filtro.id)}
                />
              ))}
            </ScrollView>
            {verConcorrencia && !semClube && !clubesSemJogos ? (
              <View style={styles.filtrosClube}>
                <Chip
                  label={meusClubes.length === 1 ? 'Voltar ao meu clube' : 'Voltar aos meus clubes'}
                  selected={false}
                  onPress={() => startTransition(() => setVerConcorrencia(false))}
                  leading={
                    <View style={styles.escudos}>
                      {meusClubes.map((clube) => (
                        <Escudo key={clube.id} clube={clube} size={18} />
                      ))}
                    </View>
                  }
                />
              </View>
            ) : null}
          </View>

          <View style={styles.conteudo}>
            <SessoesAbertas />
            <ConvitesDeBoleia />
            <AlertasBoleias boleiasComSessao={boleiasComSessao} />
            {clubesSemJogos ? (
              <Aviso
                title={meusClubes.length === 1 ? 'Ainda sem jogos do teu clube' : 'Ainda sem jogos dos teus clubes'}
                message={`${TEXTO_SEM_JOGOS} Até lá, vês aqui os jogos da Liga Portugal Betclic.`}
                icon={icons.semJogos}
              />
            ) : null}
            {renderConteudo()}
          </View>
        </View>
      </ScrollView>
      {barraFixa ? (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(120)}
          style={[
            styles.barraFixa,
            { paddingTop: insets.top + Spacing.one, backgroundColor: theme.background, borderBottomColor: theme.border },
          ]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={styles.chips}
            style={styles.flex}>
            {/* The two leagues; the chosen one again goes back to all. */}
            {filtrosCompeticao
              .filter((filtro) => filtro.id !== 'todas')
              .map((filtro) => (
                <Chip
                  key={filtro.id}
                  label={filtro.label}
                  selected={competicao === filtro.id}
                  onPress={() => setCompeticao(competicao === filtro.id ? 'todas' : filtro.id)}
                />
              ))}
          </ScrollView>
          {verConcorrencia ? (
            <Chip label="Esconder jogos" selected={false} onPress={() => setVerConcorrencia(false)} />
          ) : null}
        </Animated.View>
      ) : null}
      {voltarAoTopo}
    </View>
  );
}

const MARGEM = 20;

const styles = StyleSheet.create({
  barraFixa: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  relvadoAcima: {
    position: 'absolute',
    top: -1000,
    left: 0,
    right: 0,
    height: 1000,
  },
  largura: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  filtros: {
    gap: 10,
    paddingTop: 18,
  },
  chips: {
    gap: Spacing.two,
    paddingHorizontal: MARGEM,
  },
  escudos: {
    flexDirection: 'row',
    gap: 2,
  },
  concorrencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  concorrenciaTitulo: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 800,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  filtrosClube: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: MARGEM,
  },
  conteudo: {
    gap: 26,
    paddingTop: 22,
    paddingHorizontal: MARGEM,
  },
  grupo: {
    gap: 12,
  },
  cabecalhoDia: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  tituloDia: {
    flexShrink: 1,
    fontSize: 28,
    lineHeight: 31,
  },
  totalDia: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 700,
  },
});
