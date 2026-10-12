import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OpcaoClube } from '@/components/opcao-clube';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useClubSupporterCounts } from '@/features/profile/hooks/useMyProfile';
import { textoAdeptosNaApp } from '@/lib/clubes';
import {
  clubesParaEscolher,
  DIVISOES_COM_JOGOS,
  nomesDivisao,
  TEXTO_SEM_JOGOS,
} from '@/mocks/clubes';
import { useAppState } from '@/state/app-state';
import { ThemedText } from '@/ui/themed-text';

export default function EscolherClubeScreen() {
  const adeptos = useClubSupporterCounts();
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

      {clubesParaEscolher().map((grupo) => (
        <View key={grupo.divisao} style={styles.grupo}>
          <ThemedText
            type="eyebrow"
            themeColor="textSecondary"
            style={styles.divisao}
            accessibilityRole="header">
            {nomesDivisao[grupo.divisao]}
          </ThemedText>
          {DIVISOES_COM_JOGOS.includes(grupo.divisao) ? null : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.divisao}>
              {TEXTO_SEM_JOGOS}
            </ThemedText>
          )}
          {grupo.clubes.map((clube) => (
            <OpcaoClube
              key={clube.id}
              clube={clube}
              detalhe={textoAdeptosNaApp(adeptos.data?.[clube.id])}
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
    gap: Spacing.four,
    padding: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },
  titulo: {
    fontSize: 34,
    lineHeight: 38,
    paddingHorizontal: 6,
  },
  grupo: {
    gap: Spacing.two,
  },
  divisao: {
    paddingHorizontal: 6,
    paddingBottom: Spacing.one,
  },
});
