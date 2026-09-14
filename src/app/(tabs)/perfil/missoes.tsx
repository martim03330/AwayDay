import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumResumo } from '@/components/album-resumo';
import { ListaMissoes } from '@/components/missoes-card';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { useAppState } from '@/state/app-state';
import { Icon, icons } from '@/ui/icon';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

export default function MissoesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { fotosMissoes } = useAppState();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[styles.conteudo, { paddingTop: insets.top + Spacing.three }]}>
      <View style={styles.cabecalho}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={8}
          style={({ pressed }) => [
            styles.voltar,
            {
              backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}>
          <Icon name={icons.voltar} size={20} color={theme.text} />
        </Pressable>
        <View style={styles.titulos} accessibilityRole="header">
          <ThemedText type="eyebrow" themeColor="accentInk">
            Passaporte
          </ThemedText>
          <ThemedText type="title" style={styles.titulo}>
            Missões
          </ThemedText>
        </View>
      </View>

      <ListaMissoes />

      <SectionHeader
        title="Álbum de recordações"
        trailing={fotosMissoes.length > 0 ? plural(fotosMissoes.length, 'foto', 'fotos') : undefined}
      />
      <AlbumResumo fotos={fotosMissoes} onAbrir={() => router.push('/perfil/album')} />

      <View style={[styles.regra, { borderColor: theme.borderStrong }]}>
        <Icon name={icons.missao} size={18} color={theme.accentInk} />
        <ThemedText themeColor="textSecondary" style={styles.regraTexto}>
          <ThemedText style={[styles.regraTexto, styles.regraRotulo]}>Regra da casa: </ThemedText>
          nenhuma missão pede para trocar objetos pessoais nem contacto físico. A prova é sempre uma
          foto tirada na hora, com a câmara.
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  cabecalho: {
    gap: 14,
    paddingHorizontal: Spacing.one,
    paddingBottom: Spacing.one,
  },
  voltar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulos: {
    gap: Spacing.one,
  },
  titulo: {
    fontSize: 58,
    lineHeight: 62,
  },
  regra: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Spacing.three,
  },
  regraTexto: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  regraRotulo: {
    fontWeight: 800,
  },
});
