import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Nota } from '@/mocks/tipos';
import { ThemedText } from '@/ui/themed-text';

type MedidorProps = {
  label: string;
  emoji: string;
  value: Nota;
  compact?: boolean;
};

const ESCALA = [1, 2, 3, 4, 5] as const;

/** Escala de 1 a 5 com emojis, usada no cervejómetro e no petiscómetro. */
export function Medidor({ label, emoji, value, compact = false }: MedidorProps) {
  const accessibilityLabel = `${label}: ${value} de 5`;

  if (compact) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel} style={styles.compact}>
        <ThemedText style={styles.emojiSmall}>{emoji}</ThemedText>
        <ThemedText type="smallBold">{value}/5</ThemedText>
      </View>
    );
  }

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.full}>
      <View style={styles.header}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {value} de 5
        </ThemedText>
      </View>
      <View style={styles.scale}>
        {ESCALA.map((step) => (
          <ThemedText key={step} style={[styles.emoji, step > value && styles.off]}>
            {emoji}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  emojiSmall: {
    fontSize: 16,
    lineHeight: 22,
  },
  full: {
    gap: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scale: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  emoji: {
    fontSize: 26,
    lineHeight: 34,
  },
  off: {
    opacity: 0.2,
  },
});
