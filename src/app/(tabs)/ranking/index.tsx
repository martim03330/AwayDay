import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RankingCard } from '@/components/ranking-card';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { CartaoDivisao } from '@/features/ranks/components/CartaoDivisao';
import { LinhaMissao } from '@/features/ranks/components/LinhaMissao';
import { useAcaoDaMissao } from '@/features/ranks/hooks/useAcaoDaMissao';
import { CartaoNivel } from '@/features/ranks/components/CartaoNivel';
import { TabelaRanking } from '@/features/ranks/components/TabelaRanking';
import {
  rankingKey,
  useLeaderboard,
  useMyMissions,
  useMyRanking,
} from '@/features/ranks/hooks/useRanking';
import { segundaFeiraDe } from '@/features/ranks/labels';
import { seasonLabel } from '@/features/recap/stats';
import { useTheme } from '@/hooks/use-theme';
import { BUILD_DE_CAPTURAS } from '@/lib/capturas';
import { chaveDoDia } from '@/lib/datas';
import { formatarNumero } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { contarTascosVerificados, montarRanking, ID_UTILIZADOR } from '@/lib/tascos';
import { rankingMock } from '@/mocks/ranking';
import { useAppState } from '@/state/app-state';
import { CabecalhoRelvado } from '@/ui/cabecalho-relvado';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';
import { useVoltarAoTopo } from '@/ui/voltar-ao-topo';

const MARGEM = 20;
/** Lines of the season table shown here; the full table is one tap away. */
const TOPO = 3;

/**
 * O Ranking: o teu nível para a vida, a divisão desta época, os desafios da semana e as tabelas. Só conta o que a
 * app confirmou — carimbos no estádio, check-ins no tasco, fotos aprovadas. Marcar à mão não dá pontos.
 */
export default function RankingScreen() {
  const { ref: paginaRef, onScroll, scrollEventThrottle, botao: voltarAoTopo } = useVoltarAoTopo({
    reporNoTopo: true,
  });
  const router = useRouter();
  const theme = useTheme();
  const agir = useAcaoDaMissao();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userId = useUserId();
  const { fonte, clubeFavoritoId, visitasLocais } = useAppState();
  const conta = fonte === 'conta' ? userId : null;

  const ranking = useMyRanking(conta);
  const missoes = useMyMissions(conta);
  const topo = useLeaderboard(conta, 'geral', 'epoca');

  const eu = ranking.data;
  const estaSemana = segundaFeiraDe(chaveDoDia(new Date()));
  const semanais = (missoes.data ?? []).filter((missao) => missao.kind === 'weekly');
  const desafios = semanais.filter((missao) => missao.weekStart === estaSemana);
  const feitos = desafios.filter((missao) => missao.completedAt !== null).length;
  const linhasTopo = (topo.data ?? [])
    .filter((linha) => linha.position <= TOPO || linha.isMe)
    .map((linha) => ({
      chave: `${linha.position}-${linha.displayName}`,
      posicao: linha.position,
      nome: linha.displayName,
      detalhe: `Nível ${linha.level}`,
      valor: `${formatarNumero(linha.xp)} pts`,
      sou: linha.isMe,
    }));

  const refrescar = () => queryClient.invalidateQueries({ queryKey: rankingKey(conta) });

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
          conta ? (
            <RefreshControl
              refreshing={ranking.isRefetching}
              onRefresh={() => void refrescar()}
              progressViewOffset={insets.top}
              tintColor={theme.accentText}
            />
          ) : undefined
        }>
        <View style={[styles.relvadoAcima, { backgroundColor: theme.accent }]} pointerEvents="none" />
        <CabecalhoRelvado
          title="Ranking"
          eyebrow={eu?.seasonId ? `Época ${seasonLabel(eu.seasonId)}` : 'Pontos, níveis e divisões'}
        />

        <View style={[styles.largura, styles.conteudo]}>
          {fonte === 'demo' ? (
            <View style={styles.bloco}>
              {BUILD_DE_CAPTURAS ? null : (
                <ThemedText themeColor="textSecondary">
                  No modo demo, o ranking mostra adeptos de exemplo. Com conta, os pontos vêm do que a
                  app confirmou: carimbos no estádio, check-ins nos tascos e fotos aprovadas.
                </ThemedText>
              )}
              <SectionHeader title="Tascos verificados" />
              <RankingCard
                ranking={montarRanking(rankingMock, {
                  id: ID_UTILIZADOR,
                  nome: 'Tu',
                  clubeId: clubeFavoritoId,
                  tascosVerificados: contarTascosVerificados(visitasLocais),
                })}
              />
            </View>
          ) : !conta ? (
            <EmptyState
              icon={icons.ranking}
              title="O ranking precisa de conta"
              message="Os pontos são de pessoas reais, confirmados no estádio e nos tascos: entra para começares a somar."
              action={{ label: 'Entrar', onPress: () => router.push('/conta/entrar') }}
            />
          ) : ranking.isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : !eu ? (
            <EmptyState
              icon={icons.erro}
              title="O ranking não carregou"
              message="Verifica a ligação e puxa para baixo para tentar outra vez."
            />
          ) : (
            <>
              <CartaoNivel ranking={eu} />

              <View style={styles.bloco}>
                <SectionHeader
                  title="Desafios da semana"
                  trailing={desafios.length > 0 ? `${feitos} de ${desafios.length}` : undefined}
                />
                <Card style={styles.lista}>
                  {desafios.length > 0 ? (
                    desafios.map((missao, indice) => (
                      <LinhaMissao
                        key={missao.id}
                        missao={missao}
                        separador={indice < desafios.length - 1}
                        onAcao={(acao) => agir(missao, acao)}
                      />
                    ))
                  ) : (
                    <ThemedText themeColor="textSecondary" style={styles.semDesafios}>
                      Esta semana não há jogos, por isso não há desafios. Voltam com a próxima jornada.
                    </ThemedText>
                  )}
                </Card>
                <LinkTexto
                  label="Ver todos os desafios"
                  onPress={() => router.push('/ranking/missoes')}
                />
              </View>

              {eu.seasonId ? (
                <View style={styles.bloco}>
                  <SectionHeader title="Divisão" />
                  <CartaoDivisao
                    ranking={eu}
                    onPress={() =>
                      router.push({ pathname: '/ranking/tabelas', params: { ambito: 'divisao' } })
                    }
                  />
                </View>
              ) : null}

              <View style={styles.bloco}>
                <SectionHeader title="Tabela da época" />
                <TabelaRanking
                  linhas={linhasTopo}
                  vazio="Ainda ninguém somou pontos esta época. Carimba o estádio no próximo jogo."
                />
                <LinkTexto label="Ver as tabelas" onPress={() => router.push('/ranking/tabelas')} />
              </View>

            </>
          )}
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
  largura: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  conteudo: {
    gap: Spacing.four,
    paddingTop: 22,
    paddingHorizontal: MARGEM,
  },
  bloco: {
    gap: Spacing.twoAndHalf,
  },
  lista: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  semDesafios: {
    paddingVertical: Spacing.twoAndHalf,
  },
});
