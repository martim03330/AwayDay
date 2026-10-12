import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

type SectionHeaderProps = {
  title: string;
  trailing?: string;
  /** How many there are, in a round pill right after the title (e.g. the people in a group). */
  contagem?: number;
  /** Onde este título ficou no ecrã, para a barra de secções saber para onde levar. */
  onLayout?: (evento: LayoutChangeEvent) => void;
};

export function SectionHeader({ title, trailing, contagem, onLayout }: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View
      style={styles.row}
      accessibilityRole="header"
      accessibilityLabel={contagem !== undefined ? `${title}, ${contagem}` : undefined}
      onLayout={onLayout}>
      <View style={styles.titulo}>
        <ThemedText type="section" style={styles.title}>
          {title}
        </ThemedText>
        {contagem !== undefined ? (
          <View style={[styles.pastilha, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor="accentInk" style={styles.numero}>
              {contagem}
            </ThemedText>
          </View>
        ) : null}
      </View>
      {trailing ? (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.trailing}>
          {trailing}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: Spacing.two,
    // Longe do que vem antes e perto do que vem a seguir: é a distância que diz o que pertence a quê.
    marginTop: Spacing.twoAndHalf,
    marginBottom: -Spacing.two,
  },
  titulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    // O título fica numa linha; é o texto da direita que encolhe e parte linha.
    flexShrink: 0,
  },
  title: {
    flexShrink: 0,
  },
  pastilha: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: Spacing.two,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numero: {
    fontSize: 14,
    lineHeight: 18,
  },
  trailing: {
    flexShrink: 1,
    paddingBottom: 3,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
  },
});
