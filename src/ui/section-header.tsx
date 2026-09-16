import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/ui/themed-text';

type SectionHeaderProps = {
  title: string;
  trailing?: string;
  /** Onde este título ficou no ecrã, para a barra de secções saber para onde levar. */
  onLayout?: (evento: LayoutChangeEvent) => void;
};

export function SectionHeader({ title, trailing, onLayout }: SectionHeaderProps) {
  return (
    <View style={styles.row} accessibilityRole="header" onLayout={onLayout}>
      <ThemedText type="section" style={styles.title}>
        {title}
      </ThemedText>
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
  title: {
    // O título fica numa linha; é o texto da direita que encolhe e parte linha.
    flexShrink: 0,
  },
  trailing: {
    flexShrink: 1,
    paddingBottom: 3,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
  },
});
