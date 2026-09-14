import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Spacing } from '@/constants/theme';
import { useMyNudges } from '@/features/nudges/hooks/useMyNudges';
import type { NudgeItem } from '@/features/nudges/types';
import { useNow } from '@/hooks/use-now';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** Scroll speed in points per second: slow enough to read a line without chasing it. */
const SPEED = 45;
const MAX_ITEMS = 5;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
/** Space after each item, so one piece of news never runs into the next. */
const ITEM_GAP = 40;

/** The latest news worth running in the ticker: at most five, from the last two weeks. */
export function recentNudges(nudges: readonly NudgeItem[], now: number): NudgeItem[] {
  return nudges
    .filter((nudge) => {
      const created = Date.parse(nudge.createdAt);
      return created <= now && now - created <= MAX_AGE_MS;
    })
    .slice(0, MAX_ITEMS);
}

type NewsTickerProps = {
  userId: string | null;
  onPress: () => void;
};

/** News running across the top of a screen, like a TV ticker. Hidden when there is nothing recent. */
export function NewsTicker({ userId, onPress }: NewsTickerProps) {
  const nudges = useMyNudges(userId);
  const now = useNow();
  const items = recentNudges(nudges.data ?? [], now);

  if (items.length === 0) return null;
  return <Ticker items={items} onPress={onPress} />;
}

function Ticker({ items, onPress }: { items: NudgeItem[]; onPress: () => void }) {
  const reduceMotion = useReducedMotion();
  const [copyWidth, setCopyWidth] = useState(0);
  const offset = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || copyWidth === 0) return;
    // Two copies side by side: moving exactly one copy's width loops without a jump.
    offset.set(0);
    offset.set(
      withRepeat(
        withTiming(-copyWidth, { duration: (copyWidth / SPEED) * 1000, easing: Easing.linear }),
        -1,
        false
      )
    );
    return () => cancelAnimation(offset);
  }, [copyWidth, reduceMotion, offset]);

  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Novidades: ${items.map((item) => item.body).join(' ')}`}
      accessibilityHint="Abre a lista de novidades"
      style={({ pressed }) => [styles.strip, pressed && styles.pressed]}>
      <View style={styles.tag}>
        <ThemedText type="eyebrow" style={styles.tagText}>
          Novidades
        </ThemedText>
      </View>

      {reduceMotion ? (
        // No motion: the latest item, still, and the full list one tap away.
        <View style={[styles.track, styles.still]}>
          <ThemedText numberOfLines={1} style={styles.text}>
            {items[0].body}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ScrollView
            horizontal
            scrollEnabled={false}
            pointerEvents="none"
            showsHorizontalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never">
            <Animated.View style={[styles.row, moving]}>
              <Copy items={items} onLayout={(event) => setCopyWidth(event.nativeEvent.layout.width)} />
              <Copy items={items} />
            </Animated.View>
          </ScrollView>
        </View>
      )}
    </Pressable>
  );
}

function Copy({ items, onLayout }: { items: NudgeItem[]; onLayout?: (event: LayoutChangeEvent) => void }) {
  return (
    <View style={styles.row} onLayout={onLayout}>
      {items.map((item) => (
        <View key={item.id} style={styles.item}>
          <Icon name={icons.jogos} size={14} color={Colors.highlight} />
          <ThemedText style={styles.text}>{item.body}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: Colors.text,
  },
  pressed: {
    opacity: 0.85,
  },
  tag: {
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: Colors.highlight,
  },
  tagText: {
    color: Colors.highlightText,
  },
  track: {
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  still: {
    paddingHorizontal: Spacing.three - 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three - 4,
    paddingRight: ITEM_GAP - (Spacing.three - 4),
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 600,
    color: Colors.accentText,
  },
});
