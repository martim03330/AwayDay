import { type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Bloco que fica fixo no topo durante o scroll (ex.: relógio do dia de jogo). */
  cabecalhoFixo?: ReactNode;
};

/** Contentor com scroll para ecrãs dentro de uma Stack com cabeçalho nativo. */
export function Screen({ children, refreshing = false, onRefresh, cabecalhoFixo }: ScreenProps) {
  const theme = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      stickyHeaderIndices={cabecalhoFixo ? [0] : undefined}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }>
      {cabecalhoFixo ? (
        <View style={[styles.cabecalhoFixo, { backgroundColor: theme.background }]}>
          {cabecalhoFixo}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    // Blocos de um ecrã: longe uns dos outros, para se lerem como blocos e não como uma parede.
    gap: Spacing.threeAndHalf,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  cabecalhoFixo: {
    marginHorizontal: -Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
