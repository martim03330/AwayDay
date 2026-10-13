import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LocalCard } from '@/components/local-card';
import { useTheme } from '@/hooks/use-theme';
import { tascosDoEstadio } from '@/lib/estadios-dos-locais';
import { plural } from '@/lib/formatos';
import { MAX_MINUTOS_A_PE } from '@/lib/locais';
import { obterEstadio } from '@/mocks/estadios';
import type { Local } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { EmptyState } from '@/ui/empty-state';
import { Icon, icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

/**
 * Every tasco around a stadium, in its own page (on the Locais tab it was a list long enough to lose the map and the
 * club picker): confirmed first, then the suggestions, then the ones further away that are worth the walk.
 */
export default function ListaDeTascosScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { estadio: estadioId } = useLocalSearchParams<{ estadio?: string }>();
  const { fezCheckIn, pessoasAqui } = useAppState();
  const estadio = estadioId ? obterEstadio(estadioId) : undefined;

  if (!estadio) {
    return (
      <Screen voltarAoTopo={false}>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Estádio não encontrado"
          message="Volta aos locais e escolhe o clube outra vez."
          action={{ label: 'Voltar', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const { confirmados, sugestoes, valeAPena, maisLonge } = tascosDoEstadio(estadio.id);
  const longeSemNinguem = maisLonge - valeAPena.length;

  const cartao = (local: Local) => (
    <LocalCard
      key={local.id}
      local={local}
      pessoas={pessoasAqui(local)}
      checkedIn={fezCheckIn(local.id)}
      onPress={() => router.push({ pathname: '/locais/[localId]', params: { localId: local.id } })}
    />
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: `Tascos · ${estadio.nome}` }} />
      {confirmados.length > 0 ? (
        <SectionHeader title="Confirmados" trailing={plural(confirmados.length, 'sítio', 'sítios')} />
      ) : null}
      {confirmados.map(cartao)}
      {sugestoes.length > 0 ? (
        <>
          <SectionHeader title="Sugestões por confirmar" trailing={plural(sugestoes.length, 'sítio', 'sítios')} />
          <ThemedText themeColor="textSecondary" style={styles.nota}>
            Encontrados automaticamente perto do estádio. Podem não ser tascos para dia de jogo: ajuda a confirmar.
          </ThemedText>
          {sugestoes.map(cartao)}
        </>
      ) : null}
      {valeAPena.length > 0 ? (
        <>
          <SectionHeader title="Mais longe, mas vale a caminhada" trailing={plural(valeAPena.length, 'sítio', 'sítios')} />
          <ThemedText themeColor="textSecondary" style={styles.nota}>
            {`Ficam a mais de ${MAX_MINUTOS_A_PE} min a pé, mas estão confirmados ou foram sugeridos.`}
          </ThemedText>
          {valeAPena.map(cartao)}
        </>
      ) : null}
      {longeSemNinguem > 0 ? (
        <View style={[styles.banco, { borderColor: theme.borderStrong }]}>
          <Icon name={icons.aPe} size={18} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.nota}>
            {longeSemNinguem === 1
              ? `1 tasco fica a mais de ${MAX_MINUTOS_A_PE} min a pé e ainda ninguém o recomendou.`
              : `${longeSemNinguem} tascos ficam a mais de ${MAX_MINUTOS_A_PE} min a pé e ainda ninguém os recomendou.`}
          </ThemedText>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  nota: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 600,
  },
  banco: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
});
