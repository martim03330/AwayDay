import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { rankingsKey, useVerifiedPlacesRanking } from '@/features/presence/hooks/usePresence';
import { type LinhaTabela, TabelaRanking } from '@/features/ranks/components/TabelaRanking';
import { rankingKey, useLeaderboard } from '@/features/ranks/hooks/useRanking';
import { NOMES_DIVISAO, tituloDoNivel } from '@/features/ranks/labels';
import type { LeaderboardPeriod, LeaderboardScope } from '@/features/ranks/types';
import { fetchStadiumRanking } from '@/features/stamps/api';
import { formatarNumero, plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { useAppState } from '@/state/app-state';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { Segmentado } from '@/ui/segmentado';
import { ThemedText } from '@/ui/themed-text';

type Tabela = 'pontos' | 'estadios' | 'tascos';

const TABELAS = [
  { valor: 'pontos' as const, label: 'Pontos' },
  { valor: 'estadios' as const, label: 'Estádios' },
  { valor: 'tascos' as const, label: 'Tascos' },
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
  amigos:
    'Nenhum amigo teu aparece aqui. Só entra quem escolheu aparecer nas tabelas e já somou pontos.',
  clube: 'Ainda ninguém do teu clube aparece aqui. Escolhe o teu clube no perfil, se ainda não o fizeste.',
  divisao: 'Ainda ninguém da tua divisão somou pontos esta época.',
};

function eAmbito(valor: string | undefined): valor is LeaderboardScope {
  return AMBITOS.some((ambito) => ambito.valor === valor);
}

/**
 * As tabelas: pontos (com quem te comparas e desde quando), estádios carimbados e tascos verificados. Só aparece
 * quem escolheu aparecer, e tu, sempre, para saberes onde estás.
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

  const linhasPontos: LinhaTabela[] = (pontos.data ?? []).map((linha) => {
    const clube = linha.clubId ? obterClube(linha.clubId)?.nomeCurto : undefined;
    return {
      chave: `${linha.position}-${linha.displayName}`,
      posicao: linha.position,
      nome: linha.displayName,
      detalhe: [
        `Nível ${linha.level} · ${tituloDoNivel(linha.level)}`,
        ambito === 'divisao' ? null : NOMES_DIVISAO[linha.division],
        clube,
      ]
        .filter(Boolean)
        .join(' · '),
      valor: `${formatarNumero(linha.xp)} pts`,
      sou: linha.isMe,
    };
  });

  const linhasEstadios: LinhaTabela[] = (estadios.data ?? []).map((linha, indice) => ({
    chave: linha.profileId,
    posicao: indice + 1,
    nome: linha.displayName,
    detalhe: plural(linha.visits, 'jogo carimbado', 'jogos carimbados'),
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
          {ambito === 'divisao' ? (
            <ThemedText type="small" themeColor="textSecondary">
              A divisão joga-se em cada época: no fim, os de cima sobem e os de baixo descem.
            </ThemedText>
          ) : (
            <Segmentado opcoes={PERIODOS} valor={periodo} onChange={setPeriodo} />
          )}
          <TabelaRanking linhas={linhasPontos} vazio={VAZIO[ambito]} />
        </>
      ) : null}

      {tabela === 'estadios' ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Estádios diferentes carimbados no local, em dia de jogo. Marcar à mão não conta.
          </ThemedText>
          <TabelaRanking
            linhas={linhasEstadios}
            vazio="Ainda ninguém carimbou estádios. Em dia de jogo, no estádio, a app confirma que lá estás."
          />
        </>
      ) : null}

      {tabela === 'tascos' ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Tascos diferentes com check-in feito lá, pela app.
          </ThemedText>
          <TabelaRanking
            linhas={linhasTascos}
            vazio="Ainda ninguém tem tascos verificados. Faz check-in no tasco em dia de jogo."
          />
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
});
