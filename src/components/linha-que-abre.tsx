import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';

type LinhaQueAbreProps = {
  leading: ReactNode;
  title: string;
  subtitle?: string;
  /** Hairline under the row (and its detail), when another row follows in the same card. */
  separador?: boolean;
  /** The detail, shown only once the row is opened: long text, sources, notes. */
  children: ReactNode;
};

/**
 * A grouped-card row that opens in place to show its detail. Keeps a screen to one line per fact until someone wants
 * the paragraph, the note or the sources behind it.
 */
export function LinhaQueAbre({ leading, title, subtitle, separador, children }: LinhaQueAbreProps) {
  const theme = useTheme();
  const [aberta, setAberta] = useState(false);

  return (
    <View
      style={separador && { borderBottomWidth: 1, borderBottomColor: theme.backgroundSelected }}>
      <LinhaGrupo
        leading={leading}
        title={title}
        subtitle={subtitle}
        onPress={() => setAberta((atual) => !atual)}
        accessibilityLabel={`${title}${subtitle ? `. ${subtitle}` : ''}. ${aberta ? 'Toca para fechar.' : 'Toca para ver mais.'}`}
        trailing={
          <View style={aberta && styles.rodado}>
            <Icon name={icons.seguinte} size={18} color={theme.textMuted} />
          </View>
        }
      />
      {aberta ? <View style={styles.detalhe}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rodado: {
    transform: [{ rotate: '90deg' }],
  },
  detalhe: {
    gap: Spacing.two,
    paddingBottom: Spacing.twoAndHalf,
  },
});
