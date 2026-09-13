import { Pressable, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Dentro de um cartão, o fundo normal confunde-se com o do cartão: usa um tom mais escuro. */
  emCartao?: boolean;
  /** Quando o texto sozinho não chega (ex.: "Recomendo" sem dizer o prato). */
  accessibilityLabel?: string;
};

export function Chip({ label, selected, onPress, emCartao = false, accessibilityLabel }: ChipProps) {
  const theme = useTheme();
  const fundoNormal = emCartao ? theme.backgroundSelected : theme.backgroundElement;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? theme.accent : fundoNormal },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold" style={{ color: selected ? theme.accentText : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.7,
  },
});
