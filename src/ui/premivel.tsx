import { useState } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** How small a pressed control gets: enough to feel, not enough to notice. */
const ESCALA_PREMIDO = 0.97;
const ENTRAR_MS = 120;
const SAIR_MS = 180;

type EstiloPremivel = StyleProp<ViewStyle> | ((estado: { pressed: boolean }) => StyleProp<ViewStyle>);

export type PremivelProps = Omit<PressableProps, 'style'> & {
  style?: EstiloPremivel;
  /** Scale while pressed (1 turns the shrink off). */
  escala?: number;
};

/**
 * A Pressable that shrinks a little while the finger is on it, like native buttons. With Reduce Motion on it does not
 * move at all; the colour or opacity change in `style` still says it was pressed.
 */
export function Premivel({ style, escala = ESCALA_PREMIDO, onPressIn, onPressOut, ...props }: PremivelProps) {
  const reduzirMovimento = useReducedMotion();
  const tamanho = useSharedValue(1);
  const [premido, setPremido] = useState(false);

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: tamanho.get() }] }));

  function entrar(evento: GestureResponderEvent) {
    setPremido(true);
    if (!reduzirMovimento && escala !== 1) tamanho.set(withTiming(escala, { duration: ENTRAR_MS, easing: Easing.out(Easing.quad) }));
    onPressIn?.(evento);
  }

  function sair(evento: GestureResponderEvent) {
    setPremido(false);
    tamanho.set(withTiming(1, { duration: reduzirMovimento ? 0 : SAIR_MS, easing: Easing.out(Easing.quad) }));
    onPressOut?.(evento);
  }

  const estilo = typeof style === 'function' ? style({ pressed: premido }) : style;

  return <AnimatedPressable {...props} onPressIn={entrar} onPressOut={sair} style={[estilo, animado]} />;
}
