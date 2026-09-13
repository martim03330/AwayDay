import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, useReducedMotion } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

const DURACAO_MS = 300;

/** Número que rola para cima quando o valor muda. */
function NumeroRolante({ valor, style }: { valor: number; style: StyleProp<TextStyle> }) {
  const reduzirMovimento = useReducedMotion();

  // Não anima na primeira apresentação, só quando o valor muda.
  const [anterior, setAnterior] = useState(valor);
  const [mudancas, setMudancas] = useState(0);
  if (anterior !== valor) {
    setAnterior(valor);
    setMudancas((total) => total + 1);
  }

  return (
    <View style={styles.janela}>
      {/* Invisível: dá à janela a largura e altura do número atual. */}
      <ThemedText style={[style, styles.invisivel]}>{valor}</ThemedText>
      <Animated.View
        key={valor}
        entering={mudancas > 0 && !reduzirMovimento ? FadeInDown.duration(DURACAO_MS) : undefined}
        exiting={reduzirMovimento ? undefined : FadeOutUp.duration(DURACAO_MS)}
        style={styles.camada}>
        <ThemedText style={style}>{valor}</ThemedText>
      </Animated.View>
    </View>
  );
}

type ContadorPessoasProps = {
  count: number;
  large?: boolean;
};

export function ContadorPessoas({ count, large = false }: ContadorPessoasProps) {
  const theme = useTheme();
  const label = count === 1 ? 'pessoa aqui' : 'pessoas aqui';

  return (
    <View style={styles.row} accessible accessibilityLabel={`${count} ${label}`}>
      <View style={[styles.dot, { backgroundColor: theme.success }]} />
      <View style={styles.texto}>
        <NumeroRolante valor={count} style={large ? styles.numeroGrande : styles.numero} />
        <ThemedText type={large ? 'default' : 'small'} themeColor="textSecondary">
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  texto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  janela: {
    overflow: 'hidden',
  },
  invisivel: {
    opacity: 0,
  },
  camada: {
    ...StyleSheet.absoluteFill,
  },
  numero: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  numeroGrande: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
});
