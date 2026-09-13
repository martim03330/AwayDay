import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/ui/themed-text';

type SectionHeaderProps = {
  title: string;
  trailing?: string;
};

export function SectionHeader({ title, trailing }: SectionHeaderProps) {
  return (
    <View style={styles.row} accessibilityRole="header">
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.title}>
        {title}
      </ThemedText>
      {trailing ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.trailing}>
          {trailing}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
    marginTop: Spacing.two,
  },
  title: {
    // O título fica numa linha; é o texto da direita que encolhe e parte linha.
    flexShrink: 0,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trailing: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
