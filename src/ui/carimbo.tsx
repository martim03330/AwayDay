import { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { BounceIn } from 'react-native-reanimated';

/** Duração máxima das animações da app. */
export const DURACAO_CARIMBO_MS = 400;

type CarimboProps = {
  /** Quando `true`, entra com ressalto (carimbo acabado de ganhar). */
  novo: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Carimbo do passaporte, usado nos estádios e nas missões concluídas. */
export function Carimbo({ novo, children, style, accessibilityLabel }: CarimboProps) {
  return (
    <Animated.View
      // Mudar a key volta a montar a vista, o que dispara a entrada com ressalto.
      key={novo ? 'novo' : 'visto'}
      entering={novo ? BounceIn.duration(DURACAO_CARIMBO_MS) : undefined}
      accessible
      accessibilityLabel={accessibilityLabel}
      style={style}>
      {children}
    </Animated.View>
  );
}
