import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useGroupTrips } from '@/features/groups/hooks/useGroups';
import { formatarData } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { Card } from '@/ui/card';
import { Screen } from '@/ui/screen';
import { ThemedText } from '@/ui/themed-text';

/** As viagens do grupo: os jogos a que a malta já foi junta. */
export default function HistoricoDoGrupoScreen() {
  const router = useRouter();
  const { grupoId } = useLocalSearchParams<{ grupoId?: string }>();
  const viagens = useGroupTrips(grupoId ?? null);
  const lista = viagens.data ?? [];

  return (
    <Screen refreshing={viagens.isRefetching} onRefresh={() => void viagens.refetch()}>
      {viagens.isLoading ? (
        <ThemedText themeColor="textSecondary">A procurar as viagens do grupo…</ThemedText>
      ) : lista.length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">
            Ainda não há viagens deste grupo. Assim que a malta for junta a um jogo, a viagem fica
            aqui — mesmo depois do jogo acabar.
          </ThemedText>
        </Card>
      ) : (
        lista.map((viagem) => {
          const jogo = obterJogo(viagem.fixtureId);
          const nome = jogo
            ? `${obterClube(jogo.casaId)?.nomeCurto ?? ''} x ${obterClube(jogo.foraId)?.nomeCurto ?? ''}`
            : 'Jogo';
          return (
            <Card
              key={viagem.fixtureId}
              style={styles.cartao}
              onPress={
                jogo
                  ? () =>
                      router.push({
                        pathname: '/jogos/[jogoId]',
                        params: { jogoId: viagem.fixtureId },
                      })
                  : undefined
              }
              accessibilityLabel={`${nome}. Toca para abrir o jogo.`}>
              <ThemedText style={styles.nome}>{nome}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[
                  formatarData(new Date(viagem.kickoffAt)),
                  viagem.rides > 0 ? plural(viagem.rides, 'boleia', 'boleias') : null,
                  viagem.houses > 0 ? plural(viagem.houses, 'casa', 'casas') : null,
                  viagem.expenses > 0 ? `${formatarCentimos(viagem.totalCents)} gastos` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.one,
  },
  nome: {
    fontWeight: 700,
  },
});
