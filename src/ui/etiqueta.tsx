import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** `destaque`: yellow card (e.g. "Falta a foto"). `info`: sky (e.g. "Mais rápido"). */
export type TomEtiqueta = 'positivo' | 'aviso' | 'negativo' | 'neutro' | 'destaque' | 'info';

type EtiquetaProps = {
  icon?: IconName;
  label: string;
  tone: TomEtiqueta;
};

export function Etiqueta({ icon, label, tone }: EtiquetaProps) {
  const theme = useTheme();
  const cores = {
    positivo: { fundo: theme.successBackground, texto: theme.successText },
    aviso: { fundo: theme.warningBackground, texto: theme.warning },
    negativo: { fundo: theme.dangerBackground, texto: theme.dangerText },
    neutro: { fundo: theme.backgroundSelected, texto: theme.textSecondary },
    destaque: { fundo: theme.highlight, texto: theme.highlightText },
    info: { fundo: theme.infoBackground, texto: theme.infoText },
  }[tone];

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.etiqueta, { backgroundColor: cores.fundo }]}>
      {icon ? <Icon name={icon} size={13} color={cores.texto} strokeWidth={2.6} /> : null}
      <ThemedText style={[styles.label, { color: cores.texto }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    // Nunca passa a largura disponível: textos longos partem linha dentro da etiqueta.
    flexShrink: 1,
    maxWidth: '100%',
    minHeight: 26,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 13,
  },
  label: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 800,
  },
});
