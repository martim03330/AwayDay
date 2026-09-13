import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ListaClubeDaTerra } from '@/components/lista-clube-terra';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { obterClube } from '@/mocks/clubes';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { ThemedText } from '@/ui/themed-text';

/** Índice do filho do ScrollView que fica fixo no topo (a barra de confirmação). */
const INDICE_BARRA_CONFIRMAR = 1;

export default function ClubeDaTerraScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { clubeDaTerraId, confirmarClubeDaTerra } = useAppState();
  // Começa só com a escolha já confirmada; as sugestões nunca vêm pré-selecionadas.
  const [selecionadoId, setSelecionadoId] = useState<string | null>(clubeDaTerraId);
  const selecionado = selecionadoId ? obterClube(selecionadoId) : undefined;

  function confirmar() {
    if (!selecionado) return;
    confirmarClubeDaTerra(selecionado.id);
    router.back();
  }

  // Num formSheet, o ScrollView tem de ser a raiz do ecrã para o conteúdo ser desenhado.
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.conteudo}
      stickyHeaderIndices={[INDICE_BARRA_CONFIRMAR]}>
      <View style={styles.cabecalho}>
        <ThemedText type="smallBold" style={styles.titulo} accessibilityRole="header">
          Clube da terra
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          O clube da tua cidade, que pode não ser o do coração. Sugerimos os que têm estádio mais
          perto de ti, mas quem escolhe és tu.
        </ThemedText>
      </View>

      <View
        style={[styles.barra, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <Button
          label={selecionado ? `Confirmar ${selecionado.nomeCurto}` : 'Escolhe um clube'}
          disabled={!selecionado || selecionado.id === clubeDaTerraId}
          onPress={confirmar}
        />
      </View>

      <View style={styles.lista}>
        <ListaClubeDaTerra selecionadoId={selecionadoId} onSelecionar={setSelecionadoId} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    paddingBottom: Spacing.six,
  },
  cabecalho: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  titulo: {
    fontSize: 20,
    lineHeight: 28,
  },
  barra: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lista: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
});
