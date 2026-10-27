import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/ui/themed-text';

type ListRowProps = {
  title: string;
  /** A second line for rows that state a fact and are not tapped («Tirada / sábado às 20:30»). */
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function ListRow({ title, subtitle, leading, trailing }: ListRowProps) {
  return (
    <View style={styles.row}>
      {leading}
      <View style={styles.body}>
        <ThemedText type="smallBold">{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  body: {
    flex: 1,
  },
});
