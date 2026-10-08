import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

type ConfirmacaoInlineProps = {
  /** One plain sentence: what happens if they confirm. */
  mensagem: string;
  confirmar: string;
  cancelar?: string;
  /** Red for what cannot be undone by the other side (taking a plan back, giving up). */
  perigo?: boolean;
  aTratar?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
};

/**
 * The confirmation for an action that changes things for other people, shown where the action is instead of a system
 * alert: the explanation and the two choices stay in the screen's own look, next to what they are about.
 */
export function ConfirmacaoInline({
  mensagem,
  confirmar,
  cancelar = 'Cancelar',
  perigo = false,
  aTratar = false,
  onConfirmar,
  onCancelar,
}: ConfirmacaoInlineProps) {
  const theme = useTheme();
  const tinta = perigo ? theme.dangerText : theme.accentInk;
  const fundo = perigo ? theme.dangerBackground : theme.successBackground;

  return (
    <View
      style={[styles.caixa, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}
      accessibilityLiveRegion="polite">
      <ThemedText type="small" themeColor="textSecondary" style={styles.mensagem}>
        {mensagem}
      </ThemedText>
      <View style={styles.botoes}>
        <Pressable
          onPress={onCancelar}
          disabled={aTratar}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.botao,
            { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement, borderColor: theme.border },
            styles.contorno,
          ]}>
          <ThemedText style={styles.rotulo}>{cancelar}</ThemedText>
        </Pressable>
        <Pressable
          onPress={onConfirmar}
          disabled={aTratar}
          accessibilityRole="button"
          accessibilityState={{ busy: aTratar }}
          style={({ pressed }) => [
            styles.botao,
            { backgroundColor: fundo, opacity: aTratar ? 0.5 : pressed ? 0.75 : 1 },
          ]}>
          <ThemedText style={[styles.rotulo, { color: tinta }]}>{aTratar ? 'A tratar…' : confirmar}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    gap: Spacing.twoAndHalf,
    padding: Spacing.three,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  mensagem: {
    lineHeight: 20,
  },
  botoes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  botao: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
  },
  contorno: {
    borderWidth: 1,
  },
  rotulo: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 700,
    textAlign: 'center',
  },
});
