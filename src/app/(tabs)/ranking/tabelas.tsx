import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { rankingsKey, useVerifiedPlacesRanking } from '@/features/presence/hooks/usePresence';
import { type LinhaTabela, TabelaRanking } from '@/features/ranks/components/TabelaRanking';
import { rankingKey, useAttendance, useLeaderboard } from '@/features/ranks/hooks/useRanking';
import type { LeaderboardPeriod, LeaderboardScope } from '@/features/ranks/types';
import { fetchStadiumRanking } from '@/features/stamps/api';
import { formatarNumero, plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { useAppState } from '@/state/app-state';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { Segmentado } from '@/ui/segmentado';
import { ThemedText } from '@/ui/themed-text';

type Tabela = 'pontos' | 'estadios' | 'tascos' | 'adeptos';

const TABELAS = [
  { valor: 'pontos' as const, label: 'Pontos' },
  { valor: 'estadios' as const, label: 'Estádios' },
  { valor: 'tascos' as const, label: 'Tascos' },
  { valor: 'adeptos' as const, label: 'Adeptos' },
];

const AMBITOS: readonly { valor: LeaderboardScope; label: string }[] = [
  { valor: 'geral', label: 'Toda a gente' },
  { valor: 'amigos', label: 'Amigos' },
  { valor: 'clube', label: 'O meu clube' },
  { valor: 'divisao', label: 'A minha divisão' },
];

const PERIODOS = [
  { valor: 'epoca' as const, label: 'Esta época' },
  { valor: 'sempre' as const, label: 'Desde sempre' },
];

const VAZIO: Record<LeaderboardScope, string> = {
  geral: 'Ainda ninguém somou pontos. Carimba o estádio no próximo jogo e és o primeiro.',
  amigos: 'Nenhum amigo teu somou pontos ainda.',
  clube: 'Ainda ninguém do teu clube somou pontos.',
  divisao: 'Ainda ninguém da tua divisão somou pontos esta época.',
};

/** Aggregates only show from 5 different people, like every other number in the app. */
const AINDA_POUCOS = 'Aparece a partir de 5 adeptos diferentes.';

function eAmbito(valor: string | undefined): valor is LeaderboardScope {
  return AMBITOS.some((ambito) => ambito.valor === valor);
}

/**
 * The tables: points (against whom and since when), stamped stadiums, verified tascos, and «Adeptos» (which stadiums
 * and clubs bring the most fans; totals only, from 5 people). Rows are kept short: name, level and the number.
 */
export default function TabelasScreen() {
  const params = useLocalSearchParams<{ ambito?: string }>();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { fonte } = useAppState();
  const conta = fonte === 'conta' ? userId : null;

  const [tabela, setTabela] = useState<Tabela>('pontos');
  const [ambito, setAmbito] = useState<LeaderboardScope>(eAmbito(params.ambito) ? params.ambito : 'geral');
  const [periodo, setPeriodo] = useState<LeaderboardPeriod>('epoca');

  const pontos = useLeaderboard(conta, ambito, ambito === 'divisao' ? 'epoca' : periodo);
  const estadios = useQuery({
    queryKey: [...rankingKey(conta), 'stadiums'],
    queryFn: conta ? () => fetchStadiumRanking(50) : skipToken,
    meta: { persist: false },
  });
  const tascos = useVerifiedPlacesRanking(conta);
  const adeptos = useAttendance(conta);

  if (!conta) {
    return (
      <Screen>
        <EmptyState
          icon={icons.ranking}
          title="As tabelas precisam de conta"
          message="São de pessoas reais, com o que a app confirmou. Entra para as veres."
        />
      </Screen>
    );
  }

  const linhasPontos: LinhaTabela[] = (pontos.data ?? []).map((linha) => ({
    chave: `${linha.position}-${linha.displayName}`,
    posicao: linha.position,
    nome: linha.displayName,
    detalhe: `Nível ${linha.level}`,
    valor: `${formatarNumero(linha.xp)} pts`,
    sou: linha.isMe,
  }));

  const linhasEstadios: LinhaTabela[] = (estadios.data ?? []).map((linha, indice) => ({
    chave: linha.profileId,
    posicao: indice + 1,
    nome: linha.displayName,
    detalhe: plural(linha.visits, 'jogo', 'jogos'),
    valor: plural(linha.stadiums, 'estádio', 'estádios'),
    sou: linha.isMe,
  }));

  const linhasTascos: LinhaTabela[] = (tascos.data ?? []).map((linha) => ({
    chave: `${linha.position}-${linha.displayName}`,
    posicao: linha.position,
    nome: linha.displayName,
    detalhe: linha.clubId ? (obterClube(linha.clubId)?.nomeCurto ?? '') : '',
    valor: plural(linha.value, 'tasco', 'tascos'),
    sou: linha.isMe,
  }));

  const linhasEstadiosCheios: LinhaTabela[] = (adeptos.venues.data ?? []).map((linha, indice) => {
    const estadio = obterEstadio(linha.venueId);
    return {
      chave: linha.venueId,
      posicao: indice + 1,
      nome: estadio?.nome ?? linha.venueId,
      detalhe: estadio?.cidade ?? '',
      valor: plural(linha.people, 'adepto', 'adeptos'),
      sou: false,
    };
  });

  const linhasClubesFora: LinhaTabela[] = (adeptos.clubs.data ?? []).map((linha, indice) => ({
    chave: linha.clubId,
    posicao: indice + 1,
    nome: obterClube(linha.clubId)?.nome ?? linha.clubId,
    detalhe: plural(linha.visits, 'jogo fora', 'jogos fora'),
    valor: plural(linha.people, 'adepto', 'adeptos'),
    sou: false,
  }));

  function refrescar() {
    void queryClient.invalidateQueries({ queryKey: rankingKey(conta) });
    void queryClient.invalidateQueries({ queryKey: rankingsKey(conta) });
  }

  return (
    <Screen refreshing={pontos.isRefetching} onRefresh={refrescar}>
      <Segmentado opcoes={TABELAS} valor={tabela} onChange={setTabela} />

      {tabela === 'pontos' ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}>
            {AMBITOS.map((opcao) => (
              <Chip
                key={opcao.valor}
                label={opcao.label}
                selected={ambito === opcao.valor}
                onPress={() => setAmbito(opcao.valor)}
              />
            ))}
          </ScrollView>
          {ambito === 'divisao' ? null : (
            <Segmentado opcoes={PERIODOS} valor={periodo} onChange={setPeriodo} />
          )}
          <TabelaRanking linhas={linhasPontos} vazio={VAZIO[ambito]} />
        </>
      ) : null}

      {tabela === 'estadios' ? (
        <TabelaRanking
          linhas={linhasEstadios}
          vazio="Ainda ninguém carimbou estádios. Em dia de jogo, carimba no estádio."
        />
      ) : null}

      {tabela === 'tascos' ? (
        <TabelaRanking
          linhas={linhasTascos}
          vazio="Ainda ninguém tem tascos verificados. Faz check-in no tasco em dia de jogo."
        />
      ) : null}

      {tabela === 'adeptos' ? (
        <>
          {adeptos.season.data ? (
            <View style={styles.resumo}>
              <ThemedText type="score" style={styles.numero}>
                {formatarNumero(adeptos.season.data.people)}
              </ThemedText>
              <ThemedText themeColor="textSecondary">adeptos nos estádios esta época</ThemedText>
            </View>
          ) : null}
          <SectionHeader title="Estádios com mais adeptos" />
          <TabelaRanking linhas={linhasEstadiosCheios} vazio={`Nenhum estádio ainda. ${AINDA_POUCOS}`} />
          <SectionHeader title="Quem leva mais gente fora" />
          <TabelaRanking linhas={linhasClubesFora} vazio={`Nenhum clube ainda. ${AINDA_POUCOS}`} />
        </>
      ) : null}

      <View style={styles.espaco} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    gap: Spacing.two,
  },
  espaco: {
    height: Spacing.two,
  },
  resumo: {
    gap: Spacing.half,
  },
  numero: {
    fontSize: 40,
    lineHeight: 44,
  },
});
