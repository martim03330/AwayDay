import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import type { RecapStats } from '@/features/recap/types';
import { useTheme } from '@/hooks/use-theme';
import { formatarNota, formatarNumero } from '@/lib/formatos';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type Tile = { value: string; label: string; highlight?: boolean };

/** Filled rating stars (the design's darker yellow, readable on white). */
const STAR_GOLD = '#F2B600';

const STRIPE_WIDTH = 18;
/** Taller than any card; the card clips what is left over. */
const STRIPE_HEIGHT = 400;
const BAND = 8 * Math.SQRT2;
const stripeBands = (() => {
  let d = '';
  for (let start = 0; start < STRIPE_HEIGHT + STRIPE_WIDTH; start += BAND * 2) {
    const end = start + BAND;
    d += `M${start} 0H${end}L${end - STRIPE_HEIGHT} ${STRIPE_HEIGHT}H${start - STRIPE_HEIGHT}z`;
  }
  return d;
})();

/** White card with a diagonal-striped edge on the left. */
function CartaoListrado({
  cores,
  accessibilityLabel,
  children,
}: {
  cores: [string, string];
  accessibilityLabel: string;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.moldura}>
        <View style={[styles.riscas, { backgroundColor: cores[1] }]}>
          <Svg width={STRIPE_WIDTH} height={STRIPE_HEIGHT} viewBox={`0 0 ${STRIPE_WIDTH} ${STRIPE_HEIGHT}`}>
            <Path d={stripeBands} fill={cores[0]} />
          </Svg>
        </View>
        <View style={styles.cartaoListradoCorpo}>{children}</View>
      </View>
    </View>
  );
}

/** The season in numbers. Only numbers the server computed; missing facts are simply left out. */
export function RecapStatsGrid({ stats }: { stats: RecapStats }) {
  const theme = useTheme();

  // Games are the big number in the screen header.
  const tiles: Tile[] = [
    { value: formatarNumero(stats.stadiums), label: stats.stadiums === 1 ? 'estádio' : 'estádios' },
    {
      value: formatarNumero(stats.newVenues),
      label: stats.newVenues === 1 ? 'estádio novo' : 'estádios novos',
      highlight: true,
    },
  ];
  if (stats.km !== null) tiles.push({ value: formatarNumero(stats.km), label: 'km (em linha reta)' });
  if (stats.places > 0) {
    tiles.push({ value: formatarNumero(stats.places), label: stats.places === 1 ? 'tasco' : 'tascos' });
  }

  return (
    <View style={styles.coluna}>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <View
            key={tile.label}
            accessible
            accessibilityLabel={`${tile.value} ${tile.label}`}
            style={[
              styles.card,
              styles.tile,
              { backgroundColor: tile.highlight ? theme.highlight : theme.backgroundElement },
            ]}>
            <ThemedText
              type="score"
              style={[styles.value, { color: tile.highlight ? theme.highlightText : theme.accent }]}>
              {tile.value}
            </ThemedText>
            <ThemedText style={[styles.label, { color: tile.highlight ? theme.warningText : theme.textSecondary }]}>
              {tile.label}
            </ThemedText>
          </View>
        ))}
      </View>

      {stats.averageScore !== null ? (
        <View
          accessible
          accessibilityLabel={`${formatarNota(stats.averageScore)} nota média que deste aos estádios`}
          style={[styles.card, styles.nota, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="score" style={styles.value}>
            {formatarNota(stats.averageScore)}
          </ThemedText>
          <View style={styles.notaTexto}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              nota média que deste aos estádios
            </ThemedText>
            <View style={styles.estrelas}>
              {[1, 2, 3, 4, 5].map((estrela) => (
                <Icon
                  key={estrela}
                  name={icons.estrela}
                  size={18}
                  color={estrela <= Math.round(stats.averageScore ?? 0) ? STAR_GOLD : theme.border}
                />
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {stats.topPlace ? (
        <CartaoListrado
          cores={[theme.highlight, theme.accent]}
          accessibilityLabel={`Tasco onde mais voltaste: ${stats.topPlace.name}, ${stats.topPlace.visits} visitas`}>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            Onde mais voltaste
          </ThemedText>
          <ThemedText type="section" style={styles.destaque}>
            {stats.topPlace.name}
          </ThemedText>
          <ThemedText style={[styles.label, { color: theme.accentInk }]}>
            {`${formatarNumero(stats.topPlace.visits)} visitas`}
          </ThemedText>
        </CartaoListrado>
      ) : null}
      {stats.topDistrict ? (
        <CartaoListrado
          cores={[theme.info, theme.backgroundElement]}
          accessibilityLabel={`Onde mais andaste: ${stats.topDistrict}`}>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            Onde mais andaste
          </ThemedText>
          <ThemedText type="section" style={styles.destaque}>
            {stats.topDistrict}
          </ThemedText>
        </CartaoListrado>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  coluna: {
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  card: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    ...CardShadow,
  },
  tile: {
    width: '48.3%',
    gap: Spacing.one,
    padding: Spacing.three,
  },
  value: {
    fontSize: 46,
    lineHeight: 50,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  nota: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: Spacing.three,
  },
  notaTexto: {
    flex: 1,
    gap: Spacing.one,
  },
  estrelas: {
    flexDirection: 'row',
    gap: 3,
  },
  moldura: {
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  riscas: {
    width: STRIPE_WIDTH,
    overflow: 'hidden',
  },
  cartaoListradoCorpo: {
    flex: 1,
    gap: Spacing.one,
    padding: Spacing.three,
  },
  destaque: {
    fontSize: 28,
    lineHeight: 31,
  },
});
