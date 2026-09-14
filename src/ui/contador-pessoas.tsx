import { useState, type ReactNode } from 'react';
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
      <ThemedText type="score" style={[style, styles.invisivel]}>
        {valor}
      </ThemedText>
      <Animated.View
        key={valor}
        entering={mudancas > 0 && !reduzirMovimento ? FadeInDown.duration(DURACAO_MS) : undefined}
        exiting={reduzirMovimento ? undefined : FadeOutUp.duration(DURACAO_MS)}
        style={styles.camada}>
        <ThemedText type="score" style={style}>
          {valor}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

type ContadorPessoasProps = {
  count: number;
  /**
   * `inline`: dot + number + label on one line.
   * `hero`: big green stencil number with the label (and an optional detail) beside it.
   * `tile`: dark square with a yellow stencil number and "aqui", for the tasco card.
   */
  variant?: 'inline' | 'hero' | 'tile';
  /** `hero` only: short line under the label (e.g. clubs here today). */
  detail?: string;
  /** `hero` only: small element before the detail (e.g. club crests). */
  detailLeading?: ReactNode;
};

export function ContadorPessoas({
  count,
  variant = 'inline',
  detail,
  detailLeading,
}: ContadorPessoasProps) {
  const theme = useTheme();
  const label = count === 1 ? 'pessoa aqui' : 'pessoas aqui';
  const accessibilityLabel = `${count} ${label}`;

  if (variant === 'tile') {
    return (
      <View
        accessible
        accessibilityLabel={accessibilityLabel}
        style={[styles.azulejo, { backgroundColor: theme.text }]}>
        <NumeroRolante valor={count} style={[styles.numeroAzulejo, { color: theme.highlight }]} />
        <ThemedText style={[styles.aqui, { color: theme.accentText }]}>aqui</ThemedText>
      </View>
    );
  }

  if (variant === 'hero') {
    return (
      <View
        accessible
        accessibilityLabel={detail ? `${accessibilityLabel}. ${detail}` : accessibilityLabel}
        style={styles.destaque}>
        <NumeroRolante valor={count} style={[styles.numeroDestaque, { color: theme.accent }]} />
        <View style={styles.destaqueTexto}>
          <ThemedText style={styles.labelDestaque}>{label}</ThemedText>
          {detail ? (
            <View style={styles.detalhe}>
              {detailLeading}
              <ThemedText themeColor="textSecondary" style={styles.detalheTexto}>
                {detail}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row} accessible accessibilityLabel={accessibilityLabel}>
      <View style={[styles.dot, { backgroundColor: theme.success }]} />
      <View style={styles.texto}>
        <NumeroRolante valor={count} style={styles.numero} />
        <ThemedText type="small" themeColor="textSecondary">
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
    fontSize: 18,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  azulejo: {
    flexShrink: 0,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  numeroAzulejo: {
    fontSize: 28,
    lineHeight: 31,
    fontVariant: ['tabular-nums'],
  },
  aqui: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  destaque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  numeroDestaque: {
    fontSize: 52,
    lineHeight: 57,
    fontVariant: ['tabular-nums'],
  },
  destaqueTexto: {
    flex: 1,
    gap: 3,
  },
  labelDestaque: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 800,
  },
  detalhe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detalheTexto: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
});
