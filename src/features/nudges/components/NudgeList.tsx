import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { NudgeItem } from '@/features/nudges/types';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** The user's suggestions, newest first; unread ones get a dot. */
export function NudgeList({ nudges }: { nudges: readonly NudgeItem[] }) {
  const theme = useTheme();

  if (nudges.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={icons.notificacoes}
          title="Ainda sem novidades"
          message="Quando houver um jogo que te interesse, deixamos aqui a dica."
        />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      {nudges.map((nudge, index) => {
        const unread = nudge.readAt === null;
        return (
          <View
            key={nudge.id}
            accessible
            accessibilityLabel={`${unread ? 'Por ler. ' : ''}${nudge.body}`}
            style={[
              styles.row,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.border,
                paddingTop: Spacing.three,
              },
            ]}>
            <View style={[styles.dot, { backgroundColor: unread ? theme.accent : 'transparent' }]} />
            <View style={styles.text}>
              <ThemedText type={unread ? 'smallBold' : 'small'}>{nudge.body}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatarDiaEHora(new Date(nudge.createdAt))}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});
