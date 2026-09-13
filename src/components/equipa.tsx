import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Clube } from '@/mocks/tipos';
import { Escudo } from '@/ui/escudo';
import { ThemedText } from '@/ui/themed-text';

export function Equipa({ clube, size = 44 }: { clube: Clube; size?: number }) {
  return (
    <View style={styles.equipa}>
      <Escudo clube={clube} size={size} />
      <ThemedText type="smallBold" style={styles.nome} numberOfLines={2}>
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
    textAlign: 'center',
  },
});
