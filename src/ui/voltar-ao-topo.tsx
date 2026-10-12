import { useSegments } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, CardShadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { vibrarLeve } from '@/lib/vibrar';
import { Icon, icons } from '@/ui/icon';

/** How far down (in points) before the button shows: about a screen and a half. */
const MOSTRAR_DEPOIS_DE = 1100;

/**
 * «Voltar ao topo» on long pages (testers' feedback): once you are well down a page, a small round button appears at
 * the bottom right and takes you back up. Tapping the tab you are on also scrolls up, but few people know that.
 *
 * Give `ref`, `onScroll` and `scrollEventThrottle` to the page's ScrollView and render `botao` next to it, inside a
 * container that fills the screen.
 */
export function useVoltarAoTopo() {
  const ref = useRef<ScrollView>(null);
  const [visivel, setVisivel] = useState(false);

  function onScroll(evento: NativeSyntheticEvent<NativeScrollEvent>) {
    setVisivel(evento.nativeEvent.contentOffset.y > MOSTRAR_DEPOIS_DE);
  }

  const botao = visivel ? (
    <BotaoVoltarAoTopo
      onPress={() => {
        vibrarLeve();
        ref.current?.scrollTo({ y: 0, animated: true });
      }}
    />
  ) : null;

  return { ref, onScroll, scrollEventThrottle: 100, botao };
}

function BotaoVoltarAoTopo({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Inside the tabs the tab bar is at the bottom: the button sits above it.
  const nasTabs = useSegments()[0] === '(tabs)';
  const fundo = insets.bottom + (nasTabs ? BottomTabInset : 0) + Spacing.three;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={[styles.lugar, { bottom: fundo }]}>
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Voltar ao topo"
        testID="voltar-ao-topo"
        style={({ pressed }) => [
          styles.botao,
          CardShadow,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          pressed && styles.premido,
        ]}>
        <Icon name={icons.subir} size={20} color={theme.text} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lugar: {
    position: 'absolute',
    right: Spacing.three,
  },
  botao: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premido: {
    opacity: 0.7,
  },
});
