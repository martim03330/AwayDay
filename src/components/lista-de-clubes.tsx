import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OpcaoClube } from '@/components/opcao-clube';
import { Spacing } from '@/constants/theme';
import { useClubSupporterCounts } from '@/features/profile/hooks/useMyProfile';
import { textoAdeptosNaApp } from '@/lib/clubes';
import { clubesParaEscolher, DIVISOES_COM_JOGOS, obterClube, TEXTO_SEM_JOGOS } from '@/mocks/clubes';
import type { Divisao } from '@/mocks/tipos';
import { Chip } from '@/ui/chip';
import { ThemedText } from '@/ui/themed-text';

/** Short names for the league filter. */
const NOME_CURTO: Record<Divisao, string> = { 1: 'Liga Betclic', 2: 'Liga 2', 3: 'Liga 3' };

/**
 * Choosing a club: a league filter on top (testers found the long list of every division tiresome), then that
 * league's clubs as compact rows. Opens on the league of the club already chosen.
 */
export function ListaDeClubes({
  selecionadoId,
  onEscolher,
}: {
  selecionadoId: string | null;
  onEscolher: (clubeId: string) => void;
}) {
  const adeptos = useClubSupporterCounts();
  const grupos = clubesParaEscolher();
  const [divisao, setDivisao] = useState<Divisao>(obterClube(selecionadoId)?.divisao ?? 1);
  const grupo = grupos.find((candidato) => candidato.divisao === divisao) ?? grupos[0];

  return (
    <View style={styles.tudo}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtros}
        accessibilityRole="tablist">
        {grupos.map((outro) => (
          <Chip
            key={outro.divisao}
            label={NOME_CURTO[outro.divisao]}
            selected={outro.divisao === grupo?.divisao}
            onPress={() => setDivisao(outro.divisao)}
          />
        ))}
      </ScrollView>
      {grupo && !DIVISOES_COM_JOGOS.includes(grupo.divisao) ? (
        <ThemedText type="small" themeColor="textSecondary">
          {TEXTO_SEM_JOGOS}
        </ThemedText>
      ) : null}
      <View style={styles.lista}>
        {(grupo?.clubes ?? []).map((clube) => (
          <OpcaoClube
            key={clube.id}
            clube={clube}
            detalhe={textoAdeptosNaApp(adeptos.data?.[clube.id])}
            selecionado={clube.id === selecionadoId}
            onPress={() => onEscolher(clube.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tudo: {
    gap: Spacing.three,
  },
  filtros: {
    gap: Spacing.two,
  },
  lista: {
    gap: Spacing.two,
  },
});
