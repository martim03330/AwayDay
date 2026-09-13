import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

const DURACAO_MS = 300;

type BotaoAlternarProps = {
  ativo: boolean;
  onPress: () => void;
  label: { ativo: string; inativo: string };
  icon: { ativo: IconName; inativo: IconName };
};

/** Botão com dois estados que troca de cor e conteúdo com transição (ex.: check-in). */
export function BotaoAlternar({ ativo, onPress, label, icon }: BotaoAlternarProps) {
  const theme = useTheme();
  const reduzirMovimento = useReducedMotion();
  const progresso = useSharedValue(ativo ? 1 : 0);
  const escala = useSharedValue(1);

  // Só anima o conteúdo depois da primeira mudança, não quando o ecrã abre.
  const [anterior, setAnterior] = useState(ativo);
  const [mudancas, setMudancas] = useState(0);
  if (anterior !== ativo) {
    setAnterior(ativo);
    setMudancas((total) => total + 1);
  }

  useEffect(() => {
    progresso.set(withTiming(ativo ? 1 : 0, { duration: reduzirMovimento ? 0 : DURACAO_MS }));
  }, [ativo, progresso, reduzirMovimento]);

  const fundo = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progresso.get(),
      [0, 1],
      [theme.accent, theme.backgroundSelected]
    ),
    transform: [{ scale: escala.get() }],
  }));

  function tocar() {
    if (!reduzirMovimento) {
      escala.set(withSequence(withTiming(0.96, { duration: 90 }), withTiming(1, { duration: 160 })));
    }
    onPress();
  }

  const cor = ativo ? theme.text : theme.accentText;
  const texto = ativo ? label.ativo : label.inativo;

  return (
    <Pressable
      onPress={tocar}
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={texto}>
      <Animated.View style={[styles.botao, fundo]}>
        <Animated.View
          key={String(ativo)}
          entering={mudancas > 0 && !reduzirMovimento ? FadeIn.duration(DURACAO_MS) : undefined}
          style={styles.conteudo}>
          <Icon name={ativo ? icon.ativo : icon.inativo} size={18} color={cor} />
          <ThemedText type="smallBold" style={[styles.label, { color: cor }]}>
            {texto}
          </ThemedText>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  botao: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  conteudo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  label: {
    fontSize: 16,
  },
});
