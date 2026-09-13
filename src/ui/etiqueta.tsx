import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

export type TomEtiqueta = 'positivo' | 'aviso' | 'negativo' | 'neutro';

type EtiquetaProps = {
  icon: IconName;
  label: string;
  tone: TomEtiqueta;
};

export function Etiqueta({ icon, label, tone }: EtiquetaProps) {
  const theme = useTheme();
  const cores = {
    positivo: { fundo: theme.successBackground, texto: theme.success },
    aviso: { fundo: theme.warningBackground, texto: theme.warning },
    negativo: { fundo: theme.dangerBackground, texto: theme.danger },
    neutro: { fundo: theme.backgroundSelected, texto: theme.textSecondary },
  }[tone];

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.etiqueta, { backgroundColor: cores.fundo }]}>
      <Icon name={icon} size={14} color={cores.texto} />
      <ThemedText type="smallBold" style={[styles.label, { color: cores.texto }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
  },
});
