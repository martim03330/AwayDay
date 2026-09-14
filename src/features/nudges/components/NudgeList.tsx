import { StyleSheet, View } from 'react-native';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import type { NudgeItem } from '@/features/nudges/types';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { EmptyState } from '@/ui/empty-state';
import { IconCircle, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** The user's suggestions, newest first; unread ones get a dot. */
export function NudgeList({ nudges }: { nudges: readonly NudgeItem[] }) {
  const theme = useTheme();

  if (nudges.length === 0) {
    return (
      <EmptyState
        icon={icons.notificacoes}
        title="Ainda sem novidades"
        message="Quando houver um jogo que te interesse, deixamos aqui a dica."
      />
    );
  }

  return (
    <View style={styles.lista}>
      {nudges.map((nudge) => {
        const unread = nudge.readAt === null;
        return (
          <View
            key={nudge.id}
            accessible
            accessibilityLabel={`${unread ? 'Por ler. ' : ''}${nudge.body}`}
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <IconCircle name={icons.treinador} tone={unread ? 'green' : 'neutral'} />
            <View style={styles.text}>
              <View style={styles.meta}>
                {unread ? <View style={[styles.dot, { backgroundColor: theme.accent }]} /> : null}
                <ThemedText type="eyebrow" themeColor={unread ? 'accentInk' : 'textMuted'}>
                  {formatarDiaEHora(new Date(nudge.createdAt))}
                </ThemedText>
              </View>
              <ThemedText style={[styles.body, unread && styles.bodyUnread]}>{nudge.body}</ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    ...CardShadow,
  },
  text: {
    flex: 1,
    gap: Spacing.one,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 500,
  },
  bodyUnread: {
    fontWeight: 700,
  },
});
