import { type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { vibrarSelecao } from '@/lib/vibrar';
import { Premivel } from '@/ui/premivel';
import { ThemedText } from '@/ui/themed-text';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Dentro de um cartão, o fundo normal confunde-se com o do cartão: usa um tom mais escuro. */
  emCartao?: boolean;
  /** Quando o texto sozinho não chega (ex.: "Recomendo" sem dizer o prato). */
  accessibilityLabel?: string;
  /** Small element before the label, e.g. a club crest. */
  leading?: ReactNode;
};

export function Chip({
  label,
  selected,
  onPress,
  emCartao = false,
  accessibilityLabel,
  leading,
}: ChipProps) {
  const theme = useTheme();

  return (
    <Premivel
      onPress={() => {
        vibrarSelecao();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      // 38 pt tall: the slop takes the touch area to 46 pt without spreading the chips apart.
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.chip,
        leading ? styles.withLeading : null,
        selected
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : emCartao
            ? { backgroundColor: theme.backgroundSelected, borderColor: theme.backgroundSelected }
            : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      {leading}
      <ThemedText type="smallBold" style={{ color: selected ? theme.accentText : theme.text }}>
        {label}
      </ThemedText>
    </Premivel>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  withLeading: {
    paddingLeft: 10,
    paddingRight: 14,
  },
  pressed: {
    opacity: 0.85,
  },
});
