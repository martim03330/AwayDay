import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { progressoNoNivel, proximoTitulo, tituloDoNivel } from '@/features/ranks/labels';
import type { MyRanking } from '@/features/ranks/types';
import { useTheme } from '@/hooks/use-theme';
import { formatarNumero } from '@/lib/formatos';
import { Card } from '@/ui/card';
import { ProgressBar } from '@/ui/progress-bar';
import { ThemedText } from '@/ui/themed-text';

const NIVEL_MAXIMO = 99;

function Numero({ valor, legenda }: { valor: number; legenda: string }) {
  return (
    <View style={styles.numero} accessible accessibilityLabel={`${valor} ${legenda}`}>
      <ThemedText type="score" style={styles.numeroValor}>
        {formatarNumero(valor)}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.numeroLegenda}>
        {legenda}
      </ThemedText>
    </View>
  );
}

/** The level for life: number, title, the way to the next one, and the season at a glance. */
export function CartaoNivel({ ranking }: { ranking: MyRanking }) {
  const theme = useTheme();
  const titulo = tituloDoNivel(ranking.level);
  const seguinte = proximoTitulo(ranking.level);
  const faltam = Math.max(0, ranking.nextLevelXp - ranking.totalXp);
  const caminho =
    ranking.level >= NIVEL_MAXIMO
      ? 'Nível máximo. Não há mais nada a provar.'
      : `Faltam ${formatarNumero(faltam)} pontos para o nível ${ranking.level + 1}` +
        (seguinte ? ` · ${seguinte.titulo} no nível ${seguinte.nivel}` : '');

  return (
    <Card style={styles.cartao}>
      <View style={styles.topo}>
        <View
          style={[styles.medalha, { backgroundColor: theme.highlight }]}
          accessible
          accessibilityLabel={`Nível ${ranking.level}`}>
          <ThemedText type="score" style={[styles.nivel, { color: theme.highlightText }]}>
            {ranking.level}
          </ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText type="eyebrow" themeColor="accentInk">
            {`Nível ${ranking.level}`}
          </ThemedText>
          <ThemedText type="subtitle">{titulo}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`${formatarNumero(ranking.totalXp)} pontos desde sempre`}
          </ThemedText>
        </View>
      </View>

      <ProgressBar
        progress={progressoNoNivel(ranking)}
        accessibilityLabel={`Progresso no nível ${ranking.level}`}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {caminho}
      </ThemedText>

      <View style={[styles.numeros, { borderColor: theme.border }]}>
        <Numero valor={ranking.seasonXp} legenda="pontos esta época" />
        <Numero
          valor={ranking.streakWeeks}
          legenda={ranking.streakWeeks === 1 ? 'jornada seguida' : 'jornadas seguidas'}
        />
        <Numero
          valor={ranking.stadiums}
          legenda={ranking.stadiums === 1 ? 'estádio carimbado' : 'estádios carimbados'}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.twoAndHalf,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  medalha: {
    width: 64,
    height: 64,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nivel: {
    fontSize: 34,
    lineHeight: 38,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  numeros: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.twoAndHalf,
    gap: Spacing.two,
  },
  numero: {
    flex: 1,
    gap: Spacing.half,
  },
  numeroValor: {
    fontSize: 24,
    lineHeight: 28,
  },
  numeroLegenda: {
    fontSize: 12,
    lineHeight: 16,
  },
});
