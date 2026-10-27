import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Premivel } from '@/ui/premivel';
import { ThemedText } from '@/ui/themed-text';

type LinhaGrupoProps = {
  leading: ReactNode;
  title: string;
  /** A short value at the right of the title («sáb 15:00», «2,50 €», «Cheia»): one to three words, never a sentence. */
  valor?: string;
  /**
   * A second line, only for rows that are not buttons and show a fact (an address, a label for the value above).
   * Rows you tap carry only their title (and at most a short `valor`).
   */
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
  valor,
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
      {subtitle ? (
        <View style={styles.corpo}>
          <ThemedText style={styles.titulo}>{title}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitulo}>
            {subtitle}
          </ThemedText>
        </View>
      ) : (
        <ThemedText style={[styles.corpo, styles.titulo]}>{title}</ThemedText>
      )}
      {valor ? (
        <ThemedText themeColor="textSecondary" style={styles.valor} numberOfLines={1}>
          {valor}
        </ThemedText>
      ) : null}
      {trailing}
    </View>
  );

  if (!onPress) return conteudo;

  return (
    <Premivel
      onPress={onPress}
      // Big surfaces shrink less: 0.97 on a full-width card reads as a jump.
      escala={0.98}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => pressed && styles.pressed}>
      {conteudo}
    </Premivel>
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
  subtitulo: {
    fontSize: 13,
    lineHeight: 18,
  },
  titulo: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  valor: {
    flexShrink: 0,
    maxWidth: '40%',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.85,
  },
});
