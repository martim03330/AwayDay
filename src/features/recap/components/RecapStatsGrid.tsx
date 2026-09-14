import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { RecapStats } from '@/features/recap/types';
import { useTheme } from '@/hooks/use-theme';
import { formatarNota, formatarNumero } from '@/lib/formatos';
import { ThemedText } from '@/ui/themed-text';

type Tile = { value: string; label: string };

/** The season in numbers. Only numbers the server computed; missing facts are simply left out. */
export function RecapStatsGrid({ stats }: { stats: RecapStats }) {
  const theme = useTheme();

  const tiles: Tile[] = [
    { value: formatarNumero(stats.games), label: stats.games === 1 ? 'jogo' : 'jogos' },
    { value: formatarNumero(stats.stadiums), label: stats.stadiums === 1 ? 'estádio' : 'estádios' },
    {
      value: formatarNumero(stats.newVenues),
      label: stats.newVenues === 1 ? 'estádio novo' : 'estádios novos',
    },
  ];
  if (stats.km !== null) tiles.push({ value: formatarNumero(stats.km), label: 'km (em linha reta)' });
  if (stats.places > 0) {
    tiles.push({ value: formatarNumero(stats.places), label: stats.places === 1 ? 'tasco' : 'tascos' });
  }
  if (stats.averageScore !== null) tiles.push({ value: formatarNota(stats.averageScore), label: 'nota média' });

  return (
    <View style={styles.grid}>
      {tiles.map((tile) => (
        <View
          key={tile.label}
          accessible
          accessibilityLabel={`${tile.value} ${tile.label}`}
          style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.value}>{tile.value}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {tile.label}
          </ThemedText>
        </View>
      ))}
      {stats.topPlace ? (
        <View
          accessible
          accessibilityLabel={`Tasco onde mais voltaste: ${stats.topPlace.name}, ${stats.topPlace.visits} visitas`}
          style={[styles.tile, styles.wide, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Onde mais voltaste
          </ThemedText>
          <ThemedText type="smallBold">{stats.topPlace.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`${formatarNumero(stats.topPlace.visits)} visitas`}
          </ThemedText>
        </View>
      ) : null}
      {stats.topDistrict ? (
        <View
          accessible
          accessibilityLabel={`Onde mais andaste: ${stats.topDistrict}`}
          style={[styles.tile, styles.wide, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Onde mais andaste
          </ThemedText>
          <ThemedText type="smallBold">{stats.topDistrict}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.two,
  },
  tile: {
    width: '48.5%',
    gap: Spacing.half,
    padding: Spacing.three,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  wide: {
    width: '100%',
  },
  value: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
});
