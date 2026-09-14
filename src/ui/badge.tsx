import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

type BadgeProps = {
  label: string;
  tone?: 'accent' | 'neutral' | 'highlight';
};

export function Badge({ label, tone = 'accent' }: BadgeProps) {
  const theme = useTheme();
  const colors = {
    accent: { background: theme.accent, ink: theme.accentText },
    neutral: { background: theme.backgroundSelected, ink: theme.textSecondary },
    highlight: { background: theme.highlight, ink: theme.highlightText },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: colors.background }]}>
      <ThemedText style={[styles.label, { color: colors.ink }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: Radius.pill,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 800,
  },
});
