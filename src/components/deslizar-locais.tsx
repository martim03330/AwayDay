import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** How far the finger must travel sideways to change tasco. */
const LIMIAR_PX = 60;

type Vizinho = { id: string; nome: string };

type DeslizarEntreLocaisProps = {
  anterior: Vizinho | undefined;
  seguinte: Vizinho | undefined;
  /** 1-based position in the list of places near the stadium; `total` 0 hides the navigation. */
  posicao: number;
  total: number;
  onMudar: (localId: string) => void;
  children: ReactNode;
};

function Seta({
  vizinho,
  direcao,
  onMudar,
}: {
  vizinho: Vizinho | undefined;
  direcao: 'anterior' | 'seguinte';
  onMudar: (localId: string) => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={!vizinho}
      onPress={() => vizinho && onMudar(vizinho.id)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        vizinho
          ? `${direcao === 'anterior' ? 'Tasco anterior' : 'Tasco seguinte'}: ${vizinho.nome}`
          : direcao === 'anterior'
            ? 'Não há tasco anterior'
            : 'Não há tasco seguinte'
      }
      style={({ pressed }) => [
        styles.seta,
        { backgroundColor: theme.backgroundElement },
        !vizinho && styles.setaInativa,
        pressed && styles.pressed,
      ]}>
      <Icon
        name={direcao === 'anterior' ? icons.voltar : icons.seguinte}
        size={20}
        color={theme.text}
      />
    </Pressable>
  );
}

/**
 * The tasco's header, with a sideways swipe (or the arrows) to the previous or next place near the same stadium,
 * in the same order as the Locais list. Vertical scrolling is left alone.
 */
export function DeslizarEntreLocais({
  anterior,
  seguinte,
  posicao,
  total,
  onMudar,
  children,
}: DeslizarEntreLocaisProps) {
  const reduzirMovimento = useReducedMotion();
  const deslocamento = useSharedValue(0);
  const temAnterior = anterior !== undefined;
  const temSeguinte = seguinte !== undefined;

  const deslizar = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((evento) => {
      if (reduzirMovimento) return;
      const podeIr = evento.translationX < 0 ? temSeguinte : temAnterior;
      // Where there is nothing further, the header only gives a little, so it feels like an edge.
      deslocamento.set(evento.translationX * (podeIr ? 0.6 : 0.15));
    })
    .onEnd((evento) => {
      if (evento.translationX <= -LIMIAR_PX && seguinte) onMudar(seguinte.id);
      else if (evento.translationX >= LIMIAR_PX && anterior) onMudar(anterior.id);
      deslocamento.set(reduzirMovimento ? 0 : withTiming(0, { duration: 180 }));
    });

  const movimento = useAnimatedStyle(() => ({ transform: [{ translateX: deslocamento.get() }] }));

  if (total <= 1) return <>{children}</>;

  return (
    <GestureDetector gesture={deslizar}>
      <View style={styles.area}>
        <Animated.View style={[styles.area, movimento]}>{children}</Animated.View>
        <View style={styles.navegacao}>
          <Seta vizinho={anterior} direcao="anterior" onMudar={onMudar} />
          <ThemedText type="smallBold" style={styles.posicao}>
            {`${posicao} de ${total} perto do estádio · desliza`}
          </ThemedText>
          <Seta vizinho={seguinte} direcao="seguinte" onMudar={onMudar} />
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  area: {
    gap: Spacing.three,
  },
  navegacao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  posicao: {
    flex: 1,
    textAlign: 'center',
  },
  seta: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setaInativa: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
