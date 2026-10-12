import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { vibrarSelecao } from '@/lib/vibrar';
import { Icon, icons } from '@/ui/icon';
import { NumeroAnimado } from '@/ui/numero-animado';
import { Premivel } from '@/ui/premivel';
import { ThemedText } from '@/ui/themed-text';

type QuantidadeProps = {
  /** What is being counted, on the left («Lugares para outros»). */
  rotulo: string;
  /** A short line under it, optional («Além de ti»). */
  detalhe?: string;
  valor: number;
  min: number;
  max: number;
  onChange: (valor: number) => void;
  /** How the number reads aloud and on screen («3 noites»); the bare number when absent. */
  dizer?: (valor: number) => string;
};

/**
 * A number chosen with − and + (seats, nights): one line, the number rolling as it changes, a light tap per step.
 * Replaces long rows of numbered chips.
 */
export function Quantidade({ rotulo, detalhe, valor, min, max, onChange, dizer }: QuantidadeProps) {
  const theme = useTheme();
  const mudar = (novo: number) => {
    if (novo < min || novo > max || novo === valor) return;
    vibrarSelecao();
    onChange(novo);
  };

  const botao = (sinal: -1 | 1) => {
    const desligado = sinal < 0 ? valor <= min : valor >= max;
    return (
      <Premivel
        onPress={() => mudar(valor + sinal)}
        disabled={desligado}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${sinal < 0 ? 'Menos' : 'Mais'} ${rotulo.toLowerCase()}`}
        accessibilityState={{ disabled: desligado }}
        style={[
          styles.botao,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          desligado && styles.desligado,
        ]}>
        <Icon name={sinal < 0 ? icons.menos : icons.mais} size={18} color={theme.text} />
      </Premivel>
    );
  };

  return (
    <View
      style={styles.linha}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={rotulo}
      accessibilityValue={{ text: dizer ? dizer(valor) : String(valor) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(evento) => mudar(valor + (evento.nativeEvent.actionName === 'increment' ? 1 : -1))}>
      <View style={styles.texto}>
        <ThemedText style={styles.rotulo}>{rotulo}</ThemedText>
        {detalhe ? (
          <ThemedText type="small" themeColor="textSecondary">
            {detalhe}
          </ThemedText>
        ) : null}
      </View>
      {botao(-1)}
      <NumeroAnimado valor={valor} style={styles.numero} />
      {botao(1)}
    </View>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  texto: {
    flex: 1,
    gap: 2,
  },
  rotulo: {
    fontWeight: 700,
  },
  botao: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desligado: {
    opacity: 0.35,
  },
  numero: {
    minWidth: 32,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
});
