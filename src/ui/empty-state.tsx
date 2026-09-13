import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { Button } from '@/ui/button';
import { IconCircle, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type EmptyStateProps = {
  icon: IconName;
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <IconCircle name={icon} size={26} />
      <ThemedText type="smallBold" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
        {message}
      </ThemedText>
      {action ? (
        <View style={styles.action}>
          <Button label={action.label} onPress={action.onPress} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  message: {
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.two,
  },
});
