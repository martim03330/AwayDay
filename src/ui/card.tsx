import { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { Premivel } from '@/ui/premivel';
import { ThemedView } from '@/ui/themed-view';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function Card({ children, style, onPress, accessibilityLabel }: CardProps) {
  const content = (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, style]}
      accessibilityLabel={onPress ? undefined : accessibilityLabel}>
      {children}
    </ThemedView>
  );

  if (!onPress) return content;

  return (
    <Premivel
      onPress={onPress}
      // Big surfaces shrink less: 0.97 on a full-width card reads as a jump.
      escala={0.98}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Premivel>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.twoAndHalf,
    padding: Spacing.threeAndHalf,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    ...CardShadow,
  },
  pressed: {
    opacity: 0.85,
  },
});
