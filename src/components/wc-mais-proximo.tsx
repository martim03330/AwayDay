import { StyleSheet, View } from 'react-native';

import { WcDetalhes } from '@/components/wc-detalhes';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { casasDeBanhoPerto, MAX_MINUTOS_WC } from '@/lib/casas-de-banho';
import { casasDeBanho } from '@/mocks/casas-de-banho';
import type { Coordenadas } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** O WC mais próximo e, se esse pedir bilhete ou consumo, também o mais próximo de acesso livre. */
export function WcMaisProximo({ origem }: { origem: Coordenadas }) {
  const theme = useTheme();
  const perto = casasDeBanhoPerto(origem, casasDeBanho);
  const maisProximo = perto[0];

  if (!maisProximo) {
    return (
      <Card>
        <EmptyState
          icon={icons.wc}
          title="Nenhum WC por perto"
          message={`Não mapeámos casas de banho a menos de ${MAX_MINUTOS_WC} min a pé. Vai prevenido.`}
        />
      </Card>
    );
  }

  const livre =
    maisProximo.wc.acesso === 'livre' ? undefined : perto.find(({ wc }) => wc.acesso === 'livre');

  return (
    <Card style={styles.card}>
      <WcDetalhes wc={maisProximo.wc} metros={maisProximo.metros} minutos={maisProximo.minutos} />
      {livre ? (
        <View style={[styles.alternativa, { borderTopColor: theme.backgroundSelected }]}>
          <ThemedText type="eyebrow" themeColor="accentInk">
            Sem bilhete nem consumo
          </ThemedText>
          <WcDetalhes wc={livre.wc} metros={livre.metros} minutos={livre.minutos} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  alternativa: {
    gap: 12,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
});
