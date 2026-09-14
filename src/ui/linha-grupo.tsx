import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

type LinhaGrupoProps = {
  leading: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Hairline under the row, when another row follows in the same card. */
  separador?: boolean;
};

/** Row inside a grouped card ("Interruptor e linha" in the design): settings, account, shortcuts. */
export function LinhaGrupo({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  accessibilityLabel,
  separador,
}: LinhaGrupoProps) {
  const theme = useTheme();
  const conteudo = (
    <View
      style={[
        styles.linha,
        separador && { borderBottomWidth: 1, borderBottomColor: theme.backgroundSelected },
      ]}>
      {leading}
      <View style={styles.corpo}>
        <ThemedText style={styles.titulo}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText themeColor="textSecondary" style={styles.subtitulo}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  if (!onPress) return conteudo;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => pressed && styles.pressed}>
      {conteudo}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  corpo: {
    flex: 1,
    gap: 1,
  },
  titulo: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  subtitulo: {
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.7,
  },
});
