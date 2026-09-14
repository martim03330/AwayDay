import { Pressable, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

type LinkTextoProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Para ações que apagam coisas. */
  perigo?: boolean;
};

/** Ação secundária em texto, centrada (ex.: "Esqueceste a password?"). */
export function LinkTexto({ label, onPress, disabled = false, perigo = false }: LinkTextoProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.link, (pressed || disabled) && styles.apagado]}>
      <ThemedText
        type="smallBold"
        style={[styles.texto, { color: perigo ? theme.danger : theme.accent }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  texto: {
    textAlign: 'center',
  },
  apagado: {
    opacity: 0.5,
  },
});
