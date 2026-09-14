import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { CoachMessage } from '@/features/coach/types';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/ui/card';
import { IconCircle, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type CoachBannerProps = {
  message: CoachMessage | null;
  /** Discreet line while a new message is on its way. */
  loading: boolean;
};

/** The coach message at the top of a screen. Nothing at all when there is nothing to say. */
export function CoachBanner({ message, loading }: CoachBannerProps) {
  const theme = useTheme();
  if (!message && !loading) return null;

  return (
    <Card style={styles.card} accessibilityLabel={message ? `Dica: ${message.body}` : 'A preparar uma dica'}>
      <IconCircle name={icons.notificacoes} />
      {message ? (
        <ThemedText type="small" style={styles.flex}>
          {message.body}
        </ThemedText>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            A preparar uma dica…
          </ThemedText>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
