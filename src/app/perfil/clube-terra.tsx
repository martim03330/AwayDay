import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OpcaoClube } from '@/components/opcao-clube';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { clubesMaisPerto } from '@/lib/clubes';
import { formatarKm, formatarNumero } from '@/lib/formatos';
import { clubes, obterClube } from '@/mocks/clubes';
import { estadios } from '@/mocks/estadios';
import { localizacaoUtilizador } from '@/mocks/utilizador';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

const sugestoes = clubesMaisPerto(localizacaoUtilizador.coordenadas, clubes, estadios);
const idsSugeridos = new Set(sugestoes.map(({ clube }) => clube.id));
const outrosClubes = clubes
  .filter((clube) => clube.divisao !== null && !idsSugeridos.has(clube.id))
  .sort((a, b) => a.nomeCurto.localeCompare(b.nomeCurto, 'pt'));

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

      <View style={[styles.barra, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <Button
          label={selecionado ? `Confirmar ${selecionado.nomeCurto}` : 'Escolhe um clube'}
          disabled={!selecionado || selecionado.id === clubeDaTerraId}
          onPress={confirmar}
        />
      </View>

      <View style={styles.lista}>
        <SectionHeader title="Perto de ti" trailing="Localização simulada" />
        {sugestoes.map(({ clube, km }) => (
          <OpcaoClube
            key={clube.id}
            clube={clube}
            detalhe={`Estádio a ${formatarKm(km)} · ${formatarNumero(clube.adeptosNaApp)} adeptos`}
            selecionado={clube.id === selecionadoId}
            onPress={() => setSelecionadoId(clube.id)}
          />
        ))}

        <SectionHeader title="Outros clubes" />
        {outrosClubes.map((clube) => (
          <OpcaoClube
            key={clube.id}
            clube={clube}
            detalhe={`${formatarNumero(clube.adeptosNaApp)} adeptos na app`}
            selecionado={clube.id === selecionadoId}
            onPress={() => setSelecionadoId(clube.id)}
          />
        ))}
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
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
});
