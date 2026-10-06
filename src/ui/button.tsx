import { Pressable, StyleSheet } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** `highlight`: yellow card, for the one action that matters now (e.g. check-in). */
  variant?: 'primary' | 'secondary' | 'highlight' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  /** For answer buttons (Sim / Não): tells the screen reader which one is the current answer. */
  selected?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  selected,
}: ButtonProps) {
  const theme = useTheme();
  const look = {
    primary: { background: theme.accent, pressed: theme.accentPressed, ink: theme.accentText },
    secondary: { background: theme.backgroundElement, pressed: theme.backgroundSelected, ink: theme.text },
    highlight: { background: theme.highlight, pressed: theme.highlight, ink: theme.highlightText },
    // The card colour as ink: white on the light red, near-black on the dark-mode salmon (white would fail contrast).
    danger: { background: theme.danger, pressed: theme.dangerText, ink: theme.backgroundElement },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? look.pressed : look.background },
        variant === 'secondary' && { borderWidth: 1.5, borderColor: theme.border },
        variant === 'highlight' && pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {icon ? <Icon name={icon} size={20} color={look.ink} /> : null}
      <ThemedText style={[styles.label, { color: look.ink }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 800,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.8,
  },
});
