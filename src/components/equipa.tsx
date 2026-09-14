import { StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { Clube } from '@/mocks/tipos';
import { Escudo } from '@/ui/escudo';
import { ThemedText } from '@/ui/themed-text';

type EquipaProps = {
  clube: Clube;
  size?: number;
  /** On the green pitch header: white name. */
  sobreRelvado?: boolean;
};

/** A team with a big shield and its name underneath, for the fixture header. */
export function Equipa({ clube, size = 44, sobreRelvado = false }: EquipaProps) {
  return (
    <View style={styles.equipa}>
      <Escudo clube={clube} size={size} />
      <ThemedText
        type="section"
        style={[styles.nome, sobreRelvado && { color: Colors.accentText }]}
        numberOfLines={2}>
        {clube.nomeCurto}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  equipa: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.two,
  },
  nome: {
    fontSize: 24,
    lineHeight: 26,
    textAlign: 'center',
  },
});
