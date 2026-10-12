import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutDown, FadeOutUp, useReducedMotion } from 'react-native-reanimated';

import { formatarNumero } from '@/lib/formatos';
import { partesDoNumero } from '@/ui/numero-animado-partes';
import { ThemedText, type ThemedTextProps } from '@/ui/themed-text';

const DURACAO_MS = 200;

// Going up, the new digit comes from below and the old one leaves upwards (a counter rolling on); down, the reverse.
const SOBE = { entrada: FadeInDown.duration(DURACAO_MS), saida: FadeOutUp.duration(DURACAO_MS) };
const DESCE = { entrada: FadeInUp.duration(DURACAO_MS), saida: FadeOutDown.duration(DURACAO_MS) };

type Props = {
  valor: number;
  /** How the number is written; the default is «1 200». The digits in it roll, the rest stays still. */
  formatar?: (valor: number) => string;
  type?: ThemedTextProps['type'];
  themeColor?: ThemedTextProps['themeColor'];
  /** Text style, applied to every piece (font, size, colour). */
  style?: StyleProp<TextStyle>;
  /** Layout of the row of pieces (margins, alignment). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Read instead of the written number; by default, the number as written. */
  accessibilityLabel?: string;
};

/**
 * A number that rolls when it changes, digit by digit (like the iOS counters), in a fifth of a second.
 *
 * Only the digits that changed move; the first render and Reduce Motion just show the number. Screen readers get
 * the final value as one element, never the pieces.
 */
export function NumeroAnimado({
  valor,
  formatar = formatarNumero,
  type,
  themeColor,
  style,
  containerStyle,
  accessibilityLabel,
}: Props) {
  const reduzirMovimento = useReducedMotion();
  const [anterior, setAnterior] = useState(valor);
  const [direcao, setDirecao] = useState<typeof SOBE | null>(null);
  if (anterior !== valor) {
    setAnterior(valor);
    setDirecao(valor > anterior ? SOBE : DESCE);
  }

  const texto = formatar(valor);
  const animacao = reduzirMovimento ? null : direcao;
  const estilo = [style, styles.tabular];

  return (
    <View
      style={[styles.linha, containerStyle]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? texto}>
      {partesDoNumero(texto).map((parte) =>
        parte.digito ? (
          <View key={parte.chave} style={styles.ranhura}>
            <Animated.View key={parte.texto} entering={animacao?.entrada} exiting={animacao?.saida}>
              <ThemedText type={type} themeColor={themeColor} style={estilo}>
                {parte.texto}
              </ThemedText>
            </Animated.View>
          </View>
        ) : (
          <ThemedText key={parte.chave} type={type} themeColor={themeColor} style={[estilo, styles.texto]}>
            {parte.texto}
          </ThemedText>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  // Clips the rolling digit to its own line.
  ranhura: {
    overflow: 'hidden',
  },
  // Words around the number wrap inside the row instead of running off it.
  texto: {
    flexShrink: 1,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
