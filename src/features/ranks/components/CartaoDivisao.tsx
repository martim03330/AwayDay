import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { NOMES_DIVISAO, zonaDaDivisao } from '@/features/ranks/labels';
import type { MyRanking } from '@/features/ranks/types';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

function explicacao(ranking: MyRanking) {
  const zona = zonaDaDivisao(ranking);
  if (zona === 'subida') return 'Zona de subida: se a época acabasse hoje, subias de divisão.';
  if (zona === 'descida') {
    return ranking.seasonXp <= 0
      ? 'Sem pontos esta época, desces de divisão. Basta um jogo para saíres daqui.'
      : 'Zona de descida: se a época acabasse hoje, descias. Ainda vais a tempo.';
  }
  if (ranking.division === 1) return 'Estás na divisão de topo. Agora é segurar o lugar.';
  if (ranking.promotionSpots === 0) {
    return `No fim da época sobem os primeiros com pelo menos ${ranking.promotionMinXp} pontos.`;
  }
  return ranking.promotionSpots === 1
    ? `No fim da época sobe o primeiro, se tiver pelo menos ${ranking.promotionMinXp} pontos.`
    : `No fim da época sobem os ${ranking.promotionSpots} primeiros com pelo menos ${ranking.promotionMinXp} pontos.`;
}

/** The season's division: where you are in it and what happens if the season ended today. */
export function CartaoDivisao({ ranking, onPress }: { ranking: MyRanking; onPress?: () => void }) {
  const theme = useTheme();
  const zona = zonaDaDivisao(ranking);
  const nome = NOMES_DIVISAO[ranking.division];

  return (
    <Card
      style={styles.cartao}
      onPress={onPress}
      accessibilityLabel={`Divisão ${nome}, ${ranking.divisionPosition}.º de ${ranking.divisionSize}. ${explicacao(ranking)}`}>
      <View style={styles.topo}>
        <View style={styles.flex}>
          <ThemedText type="eyebrow" themeColor="accentInk">
            A tua divisão
          </ThemedText>
          <ThemedText type="subtitle">{nome}</ThemedText>
        </View>
        <View style={styles.posicao}>
          <ThemedText type="score" style={styles.posicaoNumero}>
            {`${ranking.divisionPosition}.º`}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`de ${ranking.divisionSize}`}
          </ThemedText>
        </View>
        {onPress ? <Icon name={icons.seguinte} size={18} color={theme.textMuted} /> : null}
      </View>

      <View style={styles.etiquetas}>
        {ranking.divisionMovement === 1 ? (
          <Etiqueta label="Subiste na época passada" tone="positivo" />
        ) : null}
        {ranking.divisionMovement === -1 ? (
          <Etiqueta label="Desceste na época passada" tone="aviso" />
        ) : null}
        {zona === 'subida' ? <Etiqueta label="Zona de subida" tone="positivo" /> : null}
        {zona === 'descida' ? <Etiqueta label="Zona de descida" tone="negativo" /> : null}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {explicacao(ranking)}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.two,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  posicao: {
    alignItems: 'flex-end',
  },
  posicaoNumero: {
    fontSize: 30,
    lineHeight: 34,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
