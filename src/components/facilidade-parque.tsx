import { type Paleta, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  facilidadeEstacionamento,
  ROTULO_FACILIDADE,
  type Facilidade,
  type ParqueParaFacilidade,
} from '@/lib/facilidade-estacionamento';
import { Etiqueta, type TomEtiqueta } from '@/ui/etiqueta';
import { ThemedText } from '@/ui/themed-text';
import { StyleSheet, View } from 'react-native';

// The colour of a car park: how easy it probably is to park there. An estimate from distance, size and known
// closures — never live occupancy, which nobody publishes for free. Every place that shows the colour says so.

const TOM: Record<Facilidade, TomEtiqueta> = {
  facil: 'positivo',
  media: 'aviso',
  dificil: 'negativo',
  desconhecida: 'neutro',
};

/** The colour for a dot or a marker. */
export function corFacilidade(theme: Paleta, nivel: Facilidade) {
  if (nivel === 'facil') return theme.success;
  if (nivel === 'media') return theme.warning;
  if (nivel === 'dificil') return theme.danger;
  return theme.textMuted;
}

export function EtiquetaFacilidade({
  parque,
  jogoGrande = false,
}: {
  parque: ParqueParaFacilidade;
  jogoGrande?: boolean;
}) {
  const { nivel } = facilidadeEstacionamento(parque, { jogoGrande });
  return <Etiqueta label={ROTULO_FACILIDADE[nivel]} tone={TOM[nivel]} />;
}

/** What the colours mean, so nobody reads them as a promise of a free space. */
export function LegendaFacilidade() {
  const theme = useTheme();
  return (
    <View style={styles.legenda}>
      {(['facil', 'media', 'dificil'] as const).map((nivel) => (
        <View key={nivel} style={styles.item}>
          <View style={[styles.bola, { backgroundColor: corFacilidade(theme, nivel) }]} />
          <ThemedText type="small" themeColor="textSecondary">
            {ROTULO_FACILIDADE[nivel]}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legenda: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bola: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
