import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OpcaoClube } from '@/components/opcao-clube';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarNumero } from '@/lib/formatos';
import { clubesPorDivisao, nomesDivisao } from '@/mocks/clubes';
import { useAppState } from '@/state/app-state';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

export default function EscolherClubeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { clubeFavoritoId, escolherClube } = useAppState();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.conteudo}>
      <ThemedText type="smallBold" style={styles.titulo} accessibilityRole="header">
        Clube que apoio
      </ThemedText>

      {clubesPorDivisao.map((grupo) => (
        <View key={grupo.divisao} style={styles.grupo}>
          <SectionHeader title={nomesDivisao[grupo.divisao]} />
          {grupo.clubes.map((clube) => (
            <OpcaoClube
              key={clube.id}
              clube={clube}
              detalhe={`${formatarNumero(clube.adeptosNaApp)} adeptos na app`}
              selecionado={clube.id === clubeFavoritoId}
              onPress={() => {
                escolherClube(clube.id);
                router.back();
              }}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  titulo: {
    fontSize: 20,
    lineHeight: 28,
    marginTop: Spacing.two,
  },
  grupo: {
    gap: Spacing.two,
  },
});
