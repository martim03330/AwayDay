import { ScrollView, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { Chip } from '@/ui/chip';

export type Seccao = { id: string; titulo: string };

/**
 * O índice do ecrã do jogo: uma fila com tudo o que a página tem, para se saber o que lá está sem andar a rolar à
 * procura. Ao tocar, a página desce até essa secção.
 */
export function BarraDeSeccoes({
  seccoes,
  onIr,
}: {
  seccoes: readonly Seccao[];
  onIr: (id: string) => void;
}) {
  if (seccoes.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.fila}
      accessibilityRole="tablist">
      {seccoes.map((seccao) => (
        <Chip
          key={seccao.id}
          label={seccao.titulo}
          selected={false}
          onPress={() => onIr(seccao.id)}
          accessibilityLabel={`Ir para ${seccao.titulo}`}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fila: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
});
