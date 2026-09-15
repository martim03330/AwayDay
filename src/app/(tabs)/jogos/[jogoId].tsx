import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AvaliacaoJogo } from '@/components/avaliacao-jogo';
import { BarulhometroCard } from '@/components/barulhometro-card';
import { ComoChegar } from '@/components/como-chegar';
import { CuidadosVisitantes } from '@/components/cuidados-visitantes';
import { DistanciaCard } from '@/components/distancia-card';
import { Equipa } from '@/components/equipa';
import { EstacionamentoEstadio } from '@/components/estacionamento-estadio';
import { EstadioCard } from '@/components/estadio-card';
import { MapaJogo } from '@/components/mapa-jogo';
import { MapaPontoEncontro } from '@/components/mapa-ponto-encontro';
import { MeteorologiaCard } from '@/components/meteorologia-card';
import { PontoEncontroCard } from '@/components/ponto-encontro-card';
import { RelogioDiaDeJogo } from '@/components/relogio-dia-de-jogo';
import { WcMaisProximo } from '@/components/wc-mais-proximo';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { GoingButton } from '@/features/activity/components/GoingButton';
import { useSafetyNotes } from '@/features/safety/hooks/useSafetyNotes';
import { useBarraDeEstadoClara } from '@/hooks/use-barra-de-estado-clara';
import { useNow } from '@/hooks/use-now';
import { useSimulatedLoading } from '@/hooks/use-simulated-loading';
import { useTheme } from '@/hooks/use-theme';
import { notaDoEstadio } from '@/lib/avaliacoes';
import { mostrarBarulhometro } from '@/lib/barulhometro';
import { eClassico, notasParaVisitante } from '@/lib/classicos';
import { formatarDia, formatarDiaEHora, formatarHora } from '@/lib/datas';
import { abrirDirecoes } from '@/lib/direcoes';
import { plural } from '@/lib/formatos';
import { eCompeticaoEuropeia, estadoDoJogo } from '@/lib/jogos';
import { filtrarPorTempoAPe } from '@/lib/locais';
import { avisoDeChuva } from '@/lib/meteorologia';
import { mostrarRelogio } from '@/lib/relogio';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { nomesCompeticao, obterJogo } from '@/mocks/jogos';
import { locaisDoEstadio } from '@/mocks/locais';
import { useAppState } from '@/state/app-state';
import { Aviso } from '@/ui/aviso';
import { Button } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

/** Mowing stripes: 36 px wide, every 72 px. */
const RISCAS = Array.from({ length: 24 }, (_, index) => index * 72 + 36);
/** How far the match-day clock card climbs into the green header. */
const SOBREPOSICAO_RELOGIO = 78;

export default function JogoScreen() {
  useBarraDeEstadoClara();
  const router = useRouter();
  const theme = useTheme();
  const agora = useNow();
  const { jogoId } = useLocalSearchParams<{ jogoId: string }>();
  const { loading } = useSimulatedLoading(`jogo-${jogoId}`);
  const { avaliacoes, avaliacaoDoJogo, medicoesBarulho } = useAppState();

  const jogo = obterJogo(jogoId);
  const casa = jogo ? obterClube(jogo.casaId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;
  // Derbies between Benfica, FC Porto and Sporting get safety notes for the visiting fans.
  const classico = jogo ? eClassico(jogo) : false;
  // Every game: official routes and home fans' areas for visitors; derbies add police arrangements and incidents.
  const notasSeguranca = useSafetyNotes(jogo?.estadioId ?? null, true);

  if (loading) {
    return (
      <Screen>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
      </Screen>
    );
  }

  if (!jogo || !casa || !fora || !estadio) {
    return (
      <Screen>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Jogo não encontrado"
          message="Este jogo foi adiado para parte incerta."
          action={{ label: 'Voltar aos jogos', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const estado = estadoDoJogo(jogo, agora);
  const relogioVisivel = mostrarRelogio(jogo, agora);
  // The live strip is short and green: it sits under the header instead of overlapping it.
  const relogioSobreposto = relogioVisivel && estado !== 'a-decorrer';
  const aviso = estado === 'terminado' ? null : avisoDeChuva(jogo.meteorologia, estadio);
  const { perto } = filtrarPorTempoAPe(locaisDoEstadio(estadio.id));
  const notasVisitante = notasParaVisitante(notasSeguranca.data ?? [], fora.id).filter(
    (nota) => classico || nota.kind === 'zona_adeptos_casa' || nota.kind === 'percurso_visitantes'
  );
  const zonas = notasVisitante.flatMap((nota) =>
    nota.kind === 'zona_a_evitar' && nota.point && nota.radiusM
      ? [{ id: nota.id, titulo: nota.title, centro: nota.point, raioM: nota.radiusM }]
      : []
  );

  const inicio = new Date(jogo.inicio);
  const dia = formatarDia(inicio, agora);
  const rotuloApito =
    estado === 'a-decorrer'
      ? 'Em jogo'
      : estado === 'terminado'
        ? 'Terminado'
        : !jogo.horaConfirmada
          ? 'Por definir'
          : dia === 'Hoje' || dia === 'Amanhã'
            ? dia
            : 'Apito';

  const avaliacao = (
    <AvaliacaoJogo
      jogo={jogo}
      agora={agora}
      avaliacao={avaliacaoDoJogo(jogo.id)}
      onAvaliar={() => router.push({ pathname: '/jogos/avaliar', params: { jogoId: jogo.id } })}
    />
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.conteudo}
      stickyHeaderIndices={relogioVisivel ? [1] : undefined}>
      <View>
        <Stack.Screen options={{ title: `${casa.nomeCurto} x ${fora.nomeCurto}` }} />
        {/* Paints the iOS overscroll area above the header green instead of whitewash. */}
        <View
          style={[styles.relvadoAcima, { backgroundColor: theme.accent }]}
          pointerEvents="none"
        />

        <View
          style={[
            styles.relvado,
            { backgroundColor: theme.accent },
            relogioSobreposto && { paddingBottom: SOBREPOSICAO_RELOGIO + 22 },
          ]}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {RISCAS.map((left) => (
              <View key={left} style={[styles.risca, { left }]} />
            ))}
          </View>
          <View style={styles.circuloCentral} pointerEvents="none">
            <Svg
              width={300}
              height={300}
              viewBox="0 0 300 300"
              fill="none"
              stroke={theme.accentText}
              strokeWidth={3}>
              <Circle cx={150} cy={150} r={92} />
              <Path d="M0 150H300" />
              <Circle cx={150} cy={150} r={5} fill={theme.accentText} />
            </Svg>
          </View>

          <ThemedText type="eyebrow" style={[styles.centro, { color: theme.highlight }]}>
            {nomesCompeticao[jogo.competicao]} · {jogo.fase}
          </ThemedText>

          <View style={styles.equipas}>
            <Equipa clube={casa} size={66} sobreRelvado />
            <View style={[styles.apito, { backgroundColor: theme.background }]}>
              <ThemedText type="score" style={styles.hora}>
                {jogo.horaConfirmada ? formatarHora(inicio) : '--:--'}
              </ThemedText>
              <ThemedText type="eyebrow" themeColor="accentInk">
                {rotuloApito}
              </ThemedText>
            </View>
            <Equipa clube={fora} size={66} sobreRelvado />
          </View>

          <ThemedText style={[styles.centro, styles.quando, { color: theme.accentText }]}>
            {`${jogo.horaConfirmada ? formatarDiaEHora(inicio, agora) : `${dia} · hora por definir`} · ${estadio.nome}`}
          </ThemedText>
        </View>
      </View>

      {relogioVisivel ? (
        <View
          style={[
            styles.relogio,
            relogioSobreposto
              ? { marginTop: -SOBREPOSICAO_RELOGIO }
              : { paddingTop: Spacing.three, backgroundColor: theme.background },
          ]}>
          <RelogioDiaDeJogo jogo={jogo} venue={estadio} />
        </View>
      ) : null}

      <View style={styles.corpo}>
        {estado === 'agendado' ? <GoingButton fixtureId={jogo.id} /> : null}

        {aviso ? <Aviso title={aviso.titulo} message={aviso.mensagem} /> : null}

        {mostrarBarulhometro(jogo, agora, medicoesBarulho) ? (
          <>
            <SectionHeader
              title="Barulhómetro"
              trailing={estado === 'a-decorrer' ? 'Em jogo' : undefined}
            />
            <BarulhometroCard jogo={jogo} agora={agora} />
          </>
        ) : null}

        {estado === 'terminado' && !relogioVisivel ? avaliacao : null}

        {eCompeticaoEuropeia(jogo.competicao) ? (
          <>
            <SectionHeader title="Ponto de encontro oficial" />
            <PontoEncontroCard ponto={jogo.pontoEncontro} />
            {jogo.pontoEncontro?.coordenadas ? (
              <MapaPontoEncontro
                nome={jogo.pontoEncontro.nome}
                coordenadas={jogo.pontoEncontro.coordenadas}
                estadio={estadio}
              />
            ) : null}
          </>
        ) : null}

        <SectionHeader title="Estádio" />
        <EstadioCard venue={estadio} nota={notaDoEstadio(avaliacoes, estadio.id)} />

        <SectionHeader title="WC mais próximo" />
        <WcMaisProximo origem={estadio.coordenadas} estadioId={estadio.id} />

        {notasVisitante.length > 0 ? (
          <>
            <SectionHeader title="Cuidados para adeptos visitantes" />
            <CuidadosVisitantes notas={notasVisitante} visitante={fora} />
          </>
        ) : null}

        <SectionHeader title="Mapa" />
        <MapaJogo venue={estadio} zonas={zonas} jogo={{ id: jogo.id, inicio: jogo.inicio }} />

        {jogo.meteorologia ? (
          <>
            <SectionHeader title="Meteorologia" trailing="Previsão simulada" />
            <MeteorologiaCard meteorologia={jogo.meteorologia} />
          </>
        ) : null}

        <SectionHeader title="Distância" />
        <DistanciaCard venue={estadio} />

        <SectionHeader title="Como chegar" />
        {estadio.transportes.length > 0 ? <ComoChegar opcoes={estadio.transportes} /> : null}

        <Button
          label="Abrir o caminho no mapa"
          variant="secondary"
          icon={icons.rota}
          onPress={() => abrirDirecoes(estadio.coordenadas, 'carro')}
        />

        <SectionHeader title="Estacionamento" />
        <EstacionamentoEstadio estadioId={estadio.id} />

        <Button
          label={
            perto.length > 0
              ? `Ver ${plural(perto.length, 'local', 'locais')} perto do estádio`
              : 'Ver locais perto do estádio'
          }
          icon={icons.locais}
          onPress={() => router.navigate({ pathname: '/locais', params: { estadio: estadio.id } })}
        />

        {estado === 'terminado' && !relogioVisivel ? null : avaliacao}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingBottom: Spacing.six,
  },
  relvadoAcima: {
    position: 'absolute',
    top: -1000,
    left: 0,
    right: 0,
    height: 1000,
  },
  relvado: {
    overflow: 'hidden',
    gap: Spacing.three,
    paddingTop: Spacing.two,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: Radius.header,
    borderBottomRightRadius: Radius.header,
  },
  risca: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.075)',
  },
  circuloCentral: {
    position: 'absolute',
    top: 38,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.17,
  },
  centro: {
    textAlign: 'center',
  },
  equipas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  apito: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    boxShadow: '0 10px 24px rgba(8, 40, 22, 0.25)',
  },
  hora: {
    fontSize: 44,
    lineHeight: 48,
    fontVariant: ['tabular-nums'],
  },
  quando: {
    opacity: 0.88,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 600,
  },
  relogio: {
    paddingHorizontal: Spacing.three,
  },
  corpo: {
    gap: Spacing.three,
    paddingTop: 20,
    paddingHorizontal: Spacing.three,
  },
});
