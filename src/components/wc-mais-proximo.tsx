import { StyleSheet, View } from 'react-native';

import { WcDetalhes } from '@/components/wc-detalhes';
import { Spacing } from '@/constants/theme';
import { useRestroomsNear } from '@/features/restrooms/hooks/useRestrooms';
import { useTheme } from '@/hooks/use-theme';
import { casasDeBanhoPerto, MAX_MINUTOS_WC } from '@/lib/casas-de-banho';
import { casasDeBanho } from '@/mocks/casas-de-banho';
import type { Coordenadas } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type WcMaisProximoProps = {
  origem: Coordenadas;
  /** The stadium whose surroundings to look at. */
  estadioId: string;
};

/**
 * O WC mais próximo e, se esse pedir bilhete ou consumo, também o mais próximo de acesso livre. Sample data in demo
 * mode; outside it, real public toilets from OpenStreetMap, saying so and never guessing what it does not record.
 */
export function WcMaisProximo({ origem, estadioId }: WcMaisProximoProps) {
  const theme = useTheme();
  const { modoDemo } = useAppState();
  const reais = useRestroomsNear(estadioId, !modoDemo);
  const perto = casasDeBanhoPerto(origem, modoDemo ? casasDeBanho : (reais.data ?? []));
  const maisProximo = perto[0];

  if (!modoDemo && reais.isLoading) return null;

  if (!maisProximo) {
    return (
      <Card>
        <EmptyState
          icon={icons.wc}
          title="Nenhum WC público conhecido"
          message={`O OpenStreetMap não tem casas de banho públicas registadas a menos de ${MAX_MINUTOS_WC} min a pé. Os cafés e tascos costumam deixar usar a quem consome.`}
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
      {maisProximo.wc.fonte === 'osm' ? (
        <ThemedText type="small" themeColor="textMuted">
          Dados do OpenStreetMap: podem estar desatualizados. Confirma no local.
        </ThemedText>
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
