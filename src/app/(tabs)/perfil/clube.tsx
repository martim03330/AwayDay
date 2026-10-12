import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { ListaDeClubes } from '@/components/lista-de-clubes';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/state/app-state';
import { ThemedText } from '@/ui/themed-text';

export default function EscolherClubeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { clubeFavoritoId, escolherClube } = useAppState();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.conteudo}>
      <ThemedText type="subtitle" style={styles.titulo} accessibilityRole="header">
        Clube que apoio
      </ThemedText>

      <ListaDeClubes
        selecionadoId={clubeFavoritoId}
        onEscolher={(clubeId) => {
          escolherClube(clubeId);
          router.back();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },
  titulo: {
    fontSize: 34,
    lineHeight: 38,
    paddingHorizontal: 6,
  },
});
