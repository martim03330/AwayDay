import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { JogoCard } from '@/components/jogo-card';
import { Spacing } from '@/constants/theme';
import { useMyTripHistory } from '@/features/trips/hooks/useTrips';
import { useJogosAQueFoste } from '@/hooks/use-jogos-a-que-foste';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { useAppState } from '@/state/app-state';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

/** "Foste com o Zé e a Rita · 127,41 € em contas" — o que ficou de uma viagem, numa linha. */
function comoFoi(viagem: { companionNames: string[]; expenses: number; totalCents: number }) {
  const gente =
    viagem.companionNames.length === 0
      ? null
      : viagem.companionNames.length <= 2
        ? `Foste com ${viagem.companionNames.join(' e ')}`
        : `Foste com ${viagem.companionNames[0]} e mais ${viagem.companionNames.length - 1}`;
  const contas = viagem.expenses > 0 ? `${formatarCentimos(viagem.totalCents)} em contas` : null;
  return [gente, contas].filter(Boolean).join(' · ');
}

/** The user's history: finished games they went to. Games they skipped are not listed. */
export default function OsMeusJogosScreen() {
  const router = useRouter();
  const userId = useUserId();
  const { avaliacaoDoJogo } = useAppState();
  const { historico, aCarregar } = useJogosAQueFoste();
  const viagens = useMyTripHistory(userId !== null);

  if (aCarregar && historico.length === 0) {
    return (
      <Screen>
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </Screen>
    );
  }

  if (historico.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={icons.acesso}
          title="Ainda sem jogos"
          message="No dia do jogo, faz o carimbo no estádio: o jogo fica aqui depois do apito final."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader title="Já foste a" trailing={plural(historico.length, 'jogo', 'jogos')} />
      {historico.map((jogo) => {
        const viagem = (viagens.data ?? []).find((entrada) => entrada.fixtureId === jogo.id);
        const resumo = viagem ? comoFoi(viagem) : '';
        return (
          <View key={jogo.id} style={styles.entrada}>
            <JogoCard
              jogo={jogo}
              estado="terminado"
              avaliacao={avaliacaoDoJogo(jogo.id)}
              onPress={() =>
                router.push({ pathname: '/jogos/resumo', params: { jogoId: jogo.id } })
              }
            />
            {resumo ? (
              <ThemedText type="small" themeColor="textMuted" style={styles.resumo}>
                {resumo}
              </ThemedText>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  entrada: {
    gap: Spacing.one,
  },
  resumo: {
    paddingHorizontal: Spacing.two,
  },
});
