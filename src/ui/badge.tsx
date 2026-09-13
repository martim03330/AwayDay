import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

type BadgeProps = {
  label: string;
  tone?: 'accent' | 'neutral';
};

export function Badge({ label, tone = 'accent' }: BadgeProps) {
  const theme = useTheme();
  const accent = tone === 'accent';

  return (
    <View
      style={[styles.badge, { backgroundColor: accent ? theme.accent : theme.backgroundSelected }]}>
      <ThemedText
        type="smallBold"
        style={[styles.label, { color: accent ? theme.accentText : theme.text }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 999,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
  },
});
