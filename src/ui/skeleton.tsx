import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedView } from '@/ui/themed-view';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
};

export function Skeleton({ width = '100%', height = 16, radius = 8 }: SkeletonProps) {
  const theme = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.set(withRepeat(withTiming(0.4, { duration: 400 }), -1, true));
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.backgroundSelected },
        animatedStyle,
      ]}
    />
  );
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <ThemedView
      type="backgroundElement"
      style={styles.card}
      accessible
      accessibilityLabel="A carregar">
      <Skeleton width="40%" height={12} />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={index === lines - 1 ? '65%' : '100%'} height={18} />
      ))}
    </ThemedView>
  );
}

/** A person's page while it opens: the round photo, the name and a card underneath. */
export function SkeletonPerfil() {
  return (
    <View style={styles.perfil} accessible accessibilityLabel="A carregar">
      <Skeleton width={96} height={96} radius={48} />
      <Skeleton width="55%" height={22} />
      <Skeleton width="35%" height={14} />
      <View style={styles.largura}>
        <SkeletonCard lines={2} />
      </View>
    </View>
  );
}

const BOLHAS: readonly { minha: boolean; largura: DimensionValue; altura: number }[] = [
  { minha: false, largura: '62%', altura: 44 },
  { minha: false, largura: '48%', altura: 36 },
  { minha: true, largura: '55%', altura: 44 },
  { minha: false, largura: '70%', altura: 60 },
  { minha: true, largura: '40%', altura: 36 },
];

/** A chat while it opens: a few bubbles on both sides, shaped like the messages about to arrive. */
export function SkeletonConversa() {
  return (
    <View style={styles.conversa} accessible accessibilityLabel="A carregar">
      {BOLHAS.map((bolha, index) => (
        <View key={index} style={{ alignSelf: bolha.minha ? 'flex-end' : 'flex-start', width: bolha.largura }}>
          <Skeleton height={bolha.altura} radius={18} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  perfil: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  largura: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
  conversa: {
    alignSelf: 'stretch',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    ...CardShadow,
  },
});
