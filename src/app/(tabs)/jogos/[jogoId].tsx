import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useJogosAQueFoste } from '@/hooks/use-jogos-a-que-foste';
import { AvaliacaoJogo } from '@/components/avaliacao-jogo';
import { Equipa } from '@/components/equipa';
import { CarimboEstadio } from '@/components/carimbo-estadio';
import { PlanoDoJogo } from '@/components/plano-do-jogo';
import { MinhaBoleia, useMinhaBoleia } from '@/features/rides/components/MinhaBoleia';
import { RelogioDiaDeJogo } from '@/components/relogio-dia-de-jogo';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { GoingButton } from '@/features/activity/components/GoingButton';
import { AutocarrosDasCasas } from '@/features/casas/components/AutocarrosDasCasas';
import { CaraDoGrupo } from '@/features/groups/components/CaraDoGrupo';
import { useMyPlanForFixture } from '@/features/groups/hooks/useGroups';
import { useBarraDeEstadoClara } from '@/hooks/use-barra-de-estado-clara';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { mostrarBarulhometro } from '@/lib/barulhometro';
import { formatarDia, formatarDiaEHora, formatarHora } from '@/lib/datas';
import { useUserId } from '@/lib/session';
import { estadoDoJogo } from '@/lib/jogos';
import { precisaDeDormida } from '@/lib/dormida';
import { avisoMeteorologico } from '@/lib/meteorologia';
import { mostrarRelogio } from '@/lib/relogio';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { nomesCompeticao, obterJogo } from '@/mocks/jogos';
import { useAppState } from '@/state/app-state';
import { usePlanosJogos } from '@/state/planos-jogos';
import { Aviso } from '@/ui/aviso';
import { Card } from '@/ui/card';
import { CamadaConfetti } from '@/ui/confetti';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { EmptyState } from '@/ui/empty-state';
import { Icon, icons, type IconName } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';
import { useVoltarAoTopo } from '@/ui/voltar-ao-topo';

/** Mowing stripes: 36 px wide, every 72 px. */
const RISCAS = Array.from({ length: 24 }, (_, index) => index * 72 + 36);
/** How far the match-day clock card climbs into the green header. */
const SOBREPOSICAO_RELOGIO = 78;

/** Uma secção do jogo, em linha: o azulejo com o ícone, o que lá está, e a seta para abrir. */
function LinhaSeccao({
  icone,
  titulo,
  onPress,
  separador,
  tom = 'normal',
}: {
  icone: IconName;
  titulo: string;
  onPress: () => void;
  separador?: boolean;
  /** 'destaque': o que está a acontecer agora (amarelo), para saltar à vista. */
  tom?: 'normal' | 'destaque';
}) {
  const theme = useTheme();
  const cores =
    tom === 'destaque'
      ? { fundo: theme.highlight, tinta: theme.highlightText }
      : { fundo: theme.successBackground, tinta: theme.accentInk };

  return (
    <LinhaGrupo
      onPress={onPress}
      accessibilityLabel={`${titulo}. Toca para abrir.`}
      leading={
        <View style={[styles.azulejo, { backgroundColor: cores.fundo }]}>
          <Icon name={icone} size={20} color={cores.tinta} />
        </View>
      }
      title={titulo}
      trailing={<Icon name={icons.seguinte} size={18} color={theme.textMuted} />}
      separador={separador}
    />
  );
}

export default function JogoScreen() {
  const { foste } = useJogosAQueFoste();
  const { ref: paginaRef, onScroll, scrollEventThrottle, botao: voltarAoTopo } = useVoltarAoTopo();
  useBarraDeEstadoClara();
  const router = useRouter();
  const theme = useTheme();
  const agora = useNow();
  const { jogoId } = useLocalSearchParams<{ jogoId: string }>();
  const { avaliacaoDoJogo, medicoesBarulho, clubeDaTerraId } = useAppState();

  const { vou } = usePlanosJogos();
  const jogo = obterJogo(jogoId);
  // Already in a car to this game: the page shows that ride instead of the invitation to sort one out.
  const minhaBoleia = useMinhaBoleia(jogo?.id ?? null);
  // No car, but in a group plan for this game: the page shows that plan instead of the invitation to make one.
  const userId = useUserId();
  const meuPlano = useMyPlanForFixture(jogo?.id ?? null, userId !== null);
  const casa = jogo ? obterClube(jogo.casaId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;


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
  const aviso = estado === 'terminado' ? null : avisoMeteorologico(jogo.meteorologia, estadio);
  // Dormir fora não é só para as ilhas e o estrangeiro: quem é das ilhas também dorme fora para vir ao continente.
  const terra = clubeDaTerraId ? obterClube(clubeDaTerraId) : undefined;
  const estadioDaTerra = terra?.estadioId ? obterEstadio(terra.estadioId) : undefined;
  const dormidaFazSentido = precisaDeDormida(estadio, estadioDaTerra ?? null);

  const abrir = (pathname: string) =>
    router.push({ pathname: pathname as '/jogos/mapa', params: { jogoId: jogo.id } });

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
      podeAvaliar={foste(jogo.id)}
      onAvaliar={() => router.push({ pathname: '/jogos/avaliar', params: { jogoId: jogo.id } })}
    />
  );

  return (
    <CamadaConfetti>
      <ScrollView
        ref={paginaRef}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
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
            <View
              style={styles.circuloCentral}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
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

            <ThemedText type="eyebrow" style={[styles.centro, { color: theme.accentText }]}>
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

          <SectionHeader title="Com quem vais" />
          {estado === 'agendado' && minhaBoleia ? (
            <MinhaBoleia
              boleia={minhaBoleia}
              agora={agora}
              onAbrir={() =>
                router.push({ pathname: '/jogos/boleia', params: { rideId: minhaBoleia.id, jogoId: jogo.id } })
              }
            />
          ) : estado === 'agendado' && meuPlano ? (
            <Card style={styles.lista}>
              <LinhaGrupo
                onPress={() =>
                  router.push({
                    pathname: '/grupos/[grupoId]/plano/[planoId]',
                    params: { grupoId: meuPlano.groupId, planoId: meuPlano.plan.id },
                  })
                }
                accessibilityLabel={`Plano com ${meuPlano.groupName}. Toca para abrir.`}
                leading={<CaraDoGrupo nome={meuPlano.groupName} url={meuPlano.groupPhotoUrl} size={38} />}
                title={meuPlano.groupName}
                trailing={<Icon name={icons.seguinte} size={18} color={theme.textMuted} />}
              />
            </Card>
          ) : estado === 'agendado' ? (
            <CombinarComAMalta onPress={() => abrir('/jogos/combinar')} />
          ) : null}
          {/* The Casas' buses for this game, above the car rides; nothing at all when there are none. */}
          <AutocarrosDasCasas
            fixtureId={jogo.id}
            ativo={estado === 'agendado' && userId !== null}
            onAbrir={(viagemId) => router.push({ pathname: '/casa/viagem/[viagemId]', params: { viagemId } })}
          />
          <Card style={styles.lista}>
            <LinhaSeccao
              icone={icons.carro}
              titulo="Boleias"
              onPress={() => abrir('/jogos/boleias')}
              separador={dormidaFazSentido}
            />
            {dormidaFazSentido ? (
              <LinhaSeccao
                icone={icons.casa}
                titulo="Onde dormir"
                onPress={() => abrir('/jogos/dormir')}
              />
            ) : null}
          </Card>

          <SectionHeader title="Antes de ir" />
          <Card style={styles.lista}>
            <LinhaSeccao
              icone={icons.rota}
              titulo={estado === 'a-decorrer' ? 'Como voltar' : 'Chegar e estacionar'}
              onPress={() => abrir('/jogos/chegar')}
              separador
            />
            <LinhaSeccao
              icone={icons.estadio}
              titulo="O estádio"
              onPress={() => abrir('/jogos/estadio')}
              separador
            />
            <LinhaSeccao
              icone={icons.locais}
              titulo="Mapa e sítios"
              onPress={() => abrir('/jogos/mapa')}
            />
          </Card>

          {/* A chuva muda o que se leva: fica junto ao que se vê antes de sair de casa. */}
          {aviso ? <Aviso title={aviso.titulo} message={aviso.mensagem} /> : null}

          {/* O carimbo é uma ação de um toque: fica à mão, não atrás de um botão. */}
          <CarimboEstadio jogo={jogo} estadio={estadio} />

          {mostrarBarulhometro(jogo, agora, medicoesBarulho) ? (
            <Card style={styles.lista}>
              <LinhaSeccao
                icone={icons.som}
                tom="destaque"
                titulo="Barulhómetro"
                onPress={() => abrir('/jogos/barulho')}
              />
            </Card>
          ) : null}

          {/* O teu plano (horas e avisos) fica no fim: primeiro o que se combina. */}
          {vou(jogo.id) && estado !== 'terminado' ? <PlanoDoJogo jogo={jogo} agora={agora} /> : null}

          {avaliacao}
        </View>
      </ScrollView>
      {voltarAoTopo}
    </CamadaConfetti>
  );
}

/** O convite à malta, em destaque: é por aqui que começa um dia de jogo em grupo. */
function CombinarComAMalta({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Combinar com a malta. Convida um grupo teu para este jogo."
      style={({ pressed }) => [
        styles.combinar,
        CardShadow,
        { backgroundColor: theme.accent },
        pressed && styles.combinarPremido,
      ]}>
      <View style={[styles.combinarIcone, { backgroundColor: theme.highlight }]}>
        <Icon name={icons.perfil} size={22} color={theme.highlightText} />
      </View>
      <ThemedText type="subtitle" style={[styles.flex, { color: theme.accentText }]}>
        Combinar com a malta
      </ThemedText>
      <View style={[styles.combinarSeta, { backgroundColor: theme.accentPressed }]}>
        <Icon name={icons.seguinte} size={18} color={theme.accentText} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  combinar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  combinarPremido: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  combinarIcone: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  combinarSeta: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lista: {
    // As linhas trazem o seu espaço vertical; o lado fica com o do cartão, senão o ícone cola-se à borda.
    gap: 0,
    paddingVertical: Spacing.one,
  },
  azulejo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
