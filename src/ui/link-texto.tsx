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
        style={[
          styles.texto,
          perigo ? { color: theme.danger } : { color: theme.accentInk, textDecorationLine: 'underline' },
        ]}>
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
    fontSize: 15,
    lineHeight: 22,
    fontWeight: 800,
    textAlign: 'center',
  },
  apagado: {
    opacity: 0.5,
  },
});
