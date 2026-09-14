import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, icons, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type AvisoProps = {
  title: string;
  message: string;
  tone?: 'aviso' | 'erro' | 'sucesso';
  /** Replaces the tone's default icon (e.g. an umbrella for rain). */
  icon?: IconName;
};

export function Aviso({ title, message, tone = 'aviso', icon }: AvisoProps) {
  const theme = useTheme();
  const look = {
    aviso: { fundo: theme.warningBackground, texto: theme.warningText, icon: icons.aviso },
    erro: { fundo: theme.dangerBackground, texto: theme.dangerText, icon: icons.erro },
    sucesso: { fundo: theme.successBackground, texto: theme.successText, icon: icons.checkInFeito },
  }[tone];

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${message}`}
      style={[styles.aviso, { backgroundColor: look.fundo }]}>
      <Icon name={icon ?? look.icon} size={22} color={look.texto} />
      <View style={styles.corpo}>
        <ThemedText style={[styles.titulo, { color: look.texto }]}>{title}</ThemedText>
        <ThemedText style={[styles.mensagem, { color: look.texto }]}>{message}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three - 4,
    padding: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  corpo: {
    flex: 1,
    gap: Spacing.half,
  },
  titulo: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 800,
  },
  mensagem: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: 500,
  },
});
