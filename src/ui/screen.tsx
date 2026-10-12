import { type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useVoltarAoTopo } from '@/ui/voltar-ao-topo';

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
  const { ref: lista, onScroll, scrollEventThrottle, botao } = useVoltarAoTopo();

  return (
    <View style={[styles.tudo, { backgroundColor: theme.background }]}>
      <ScrollView
        ref={lista}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        // iOS: the keyboard becomes a bottom inset, so the focused field and the button under it can scroll into
        // view. Android resizes the window for the keyboard on its own.
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
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
      {botao}
    </View>
  );
}

const styles = StyleSheet.create({
  tudo: {
    flex: 1,
  },
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
