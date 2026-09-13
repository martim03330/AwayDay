import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ID_UTILIZADOR } from '@/lib/tascos';
import { obterClube } from '@/mocks/clubes';
import type { UtilizadorRanking } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Escudo } from '@/ui/escudo';
import { ThemedText } from '@/ui/themed-text';

type RankingCardProps = {
  ranking: readonly (UtilizadorRanking & { posicao: number })[];
};

export function RankingCard({ ranking }: RankingCardProps) {
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      {ranking.map((entrada) => {
        const clube = obterClube(entrada.clubeId);
        const eTu = entrada.id === ID_UTILIZADOR;
        return (
          <View
            key={entrada.id}
            accessible
            accessibilityLabel={`${entrada.posicao}.º lugar, ${eTu ? 'tu' : entrada.nome}, ${entrada.tascosVerificados} tascos verificados`}
            style={[styles.linha, eTu && { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.posicao}>
              {entrada.posicao}.
            </ThemedText>
            {clube ? <Escudo clube={clube} size={22} /> : null}
            <ThemedText type={eTu ? 'smallBold' : 'small'} style={styles.flex} numberOfLines={1}>
              {eTu ? 'Tu' : entrada.nome}
            </ThemedText>
            <ThemedText type="smallBold">{entrada.tascosVerificados}</ThemedText>
          </View>
        );
      })}
      <ThemedText type="small" themeColor="textSecondary">
        Ranking de demo: os outros adeptos são fictícios.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
  },
  posicao: {
    width: 24,
  },
  flex: {
    flex: 1,
  },
});
