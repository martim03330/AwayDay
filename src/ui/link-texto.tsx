import { StyleSheet } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Premivel } from '@/ui/premivel';
import { ThemedText } from '@/ui/themed-text';

type LinkTextoProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Para ações que apagam ou tiram coisas: vermelho. */
  perigo?: boolean;
  /** Para dizer que não ou deixar para depois («Agora não», «Deixa estar»): cinzento. */
  neutro?: boolean;
};

/**
 * Ação secundária: uma pastilha de fundo suave, sem sublinhado. Fica ao lado de um botão principal (ou sozinha num
 * cartão) sem competir com ele.
 */
export function LinkTexto({
  label,
  onPress,
  disabled = false,
  perigo = false,
  neutro = false,
}: LinkTextoProps) {
  const theme = useTheme();
  const tom = perigo
    ? { fundo: theme.dangerBackground, tinta: theme.dangerText }
    : neutro
      ? { fundo: theme.backgroundSelected, tinta: theme.textSecondary }
      : { fundo: theme.successBackground, tinta: theme.accentInk };

  return (
    <Premivel
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.pastilha,
        { backgroundColor: tom.fundo },
        pressed && styles.premido,
        disabled && styles.apagado,
      ]}>
      <ThemedText style={[styles.texto, { color: tom.tinta }]}>{label}</ThemedText>
    </Premivel>
  );
}

const styles = StyleSheet.create({
  pastilha: {
    alignSelf: 'center',
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderCurve: 'continuous',
  },
  texto: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: 700,
    textAlign: 'center',
  },
  premido: {
    opacity: 0.8,
  },
  apagado: {
    opacity: 0.45,
  },
});
