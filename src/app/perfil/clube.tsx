import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { clubes, DIVISOES, nomesDivisao } from '@/mocks/clubes';
import { useAppState } from '@/state/app-state';
import { Escudo } from '@/ui/escudo';
import { Icon, icons } from '@/ui/icon';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

const gruposDeClubes = DIVISOES.map((divisao) => ({
  divisao,
  clubes: clubes
    .filter((clube) => clube.divisao === divisao)
    .sort((a, b) => a.nomeCurto.localeCompare(b.nomeCurto, 'pt')),
}));

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

      {gruposDeClubes.map((grupo) => (
        <View key={grupo.divisao} style={styles.grupo}>
          <SectionHeader title={nomesDivisao[grupo.divisao]} />
          {grupo.clubes.map((clube) => {
            const selecionado = clube.id === clubeFavoritoId;
            return (
              <Pressable
                key={clube.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selecionado }}
                onPress={() => {
                  escolherClube(clube.id);
                  router.back();
                }}
                style={({ pressed }) => [
                  styles.linha,
                  {
                    backgroundColor: selecionado ? theme.backgroundSelected : theme.backgroundElement,
                  },
                  pressed && styles.pressed,
                ]}>
                <Escudo clube={clube} size={36} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{clube.nomeCurto}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {clube.nome}
                  </ThemedText>
                </View>
                {selecionado ? (
                  <Icon name={icons.selecionado} size={22} color={theme.accent} />
                ) : null}
              </Pressable>
            );
          })}
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
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
  },
  pressed: {
    opacity: 0.7,
  },
  flex: {
    flex: 1,
  },
});
