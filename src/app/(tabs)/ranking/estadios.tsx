import { useQueryClient } from '@tanstack/react-query';
import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { type LinhaTabela, TabelaRanking } from '@/features/ranks/components/TabelaRanking';
import { rankingKey, useAttendance } from '@/features/ranks/hooks/useRanking';
import { formatarNumero, plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { useAppState } from '@/state/app-state';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

const AINDA_POUCOS =
  'Aparece quando houver pelo menos 5 adeptos diferentes. Antes disso, ninguém fica à vista.';

/**
 * Quem vai à bola esta época: quantos adeptos da app foram a cada estádio e que clubes levam mais gente fora.
 * São só totais, e só aparecem a partir de 5 pessoas diferentes, como todos os números agregados da app.
 */
export default function EstadiosScreen() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { fonte } = useAppState();
  const conta = fonte === 'conta' ? userId : null;
  const { season, venues, clubs } = useAttendance(conta);

  if (!conta) {
    return (
      <Screen>
        <EmptyState
          icon={icons.estadio}
          title="Precisas de conta"
          message="Os números vêm de adeptos reais que carimbaram o estádio. Entra para os veres."
        />
      </Screen>
    );
  }

  const linhasEstadios: LinhaTabela[] = (venues.data ?? []).map((linha, indice) => {
    const estadio = obterEstadio(linha.venueId);
    return {
      chave: linha.venueId,
      posicao: indice + 1,
      nome: estadio?.nome ?? linha.venueId,
      detalhe: [estadio?.cidade, plural(linha.visits, 'carimbo', 'carimbos')].filter(Boolean).join(' · '),
      valor: plural(linha.people, 'adepto', 'adeptos'),
      sou: false,
    };
  });

  const linhasClubes: LinhaTabela[] = (clubs.data ?? []).map((linha, indice) => ({
    chave: linha.clubId,
    posicao: indice + 1,
    nome: obterClube(linha.clubId)?.nome ?? linha.clubId,
    detalhe: plural(linha.visits, 'jogo fora', 'jogos fora'),
    valor: plural(linha.people, 'adepto', 'adeptos'),
    sou: false,
  }));

  return (
    <Screen
      refreshing={season.isRefetching}
      onRefresh={() =>
        void queryClient.invalidateQueries({ queryKey: [...rankingKey(conta), 'attendance'] })
      }>
      <Card style={styles.resumo}>
        {season.data ? (
          <>
            <ThemedText type="score" style={styles.numero}>
              {formatarNumero(season.data.people)}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {`adeptos da app foram à bola esta época, em ${plural(season.data.visits, 'jogo', 'jogos')} e ${plural(season.data.venues, 'estádio', 'estádios')}. Só contam os estádios carimbados no local.`}
            </ThemedText>
          </>
        ) : (
          <ThemedText themeColor="textSecondary">
            {`Ainda não há números desta época. ${AINDA_POUCOS}`}
          </ThemedText>
        )}
      </Card>

      <SectionHeader title="Estádios com mais adeptos" />
      <TabelaRanking linhas={linhasEstadios} vazio={`Nenhum estádio ainda. ${AINDA_POUCOS}`} />

      <SectionHeader title="Quem leva mais gente fora" />
      <ThemedText type="small" themeColor="textSecondary">
        Adeptos que carimbaram o estádio num jogo em que o seu clube era o visitante.
      </ThemedText>
      <TabelaRanking linhas={linhasClubes} vazio={`Nenhum clube ainda. ${AINDA_POUCOS}`} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  resumo: {
    gap: Spacing.one,
  },
  numero: {
    fontSize: 40,
    lineHeight: 44,
  },
});
