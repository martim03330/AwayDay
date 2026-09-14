import { Alert, Share, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { RecapStatsGrid } from '@/features/recap/components/RecapStatsGrid';
import { useLatestRecap, useMarkRecapShared } from '@/features/recap/hooks/useLatestRecap';
import { seasonLabel, shareMessage } from '@/features/recap/stats';
import { useUserId } from '@/lib/session';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

export default function RetrospetivaScreen() {
  const userId = useUserId();
  const retrospetiva = useLatestRecap(userId);
  const marcarPartilhada = useMarkRecapShared(userId);

  if (!userId) {
    return (
      <Screen>
        <Card>
          <EmptyState
            icon={icons.perfil}
            title="Precisas de conta"
            message="A retrospetiva da época é feita a partir do que guardas na tua conta."
          />
        </Card>
      </Screen>
    );
  }

  if (retrospetiva.isPending) {
    return (
      <Screen>
        <SkeletonCard lines={4} />
      </Screen>
    );
  }

  if (retrospetiva.isError) {
    return (
      <Screen>
        <Card>
          <EmptyState
            icon={icons.aviso}
            title="Não deu para carregar"
            message="Verifica a ligação e tenta outra vez."
            action={{ label: 'Tentar outra vez', onPress: () => void retrospetiva.refetch() }}
          />
        </Card>
      </Screen>
    );
  }

  const dados = retrospetiva.data;
  if (!dados) {
    return (
      <Screen>
        <Card>
          <EmptyState
            icon={icons.estrela}
            title="A retrospetiva chega em junho"
            message="No fim da época juntamos os teus jogos, estádios novos e tascos num resumo para guardar e partilhar."
          />
        </Card>
      </Screen>
    );
  }

  async function partilhar() {
    if (!dados) return;
    try {
      const resultado = await Share.share({ message: shareMessage(dados) });
      if (resultado.action === Share.sharedAction) marcarPartilhada.mutate(dados.id);
    } catch {
      Alert.alert('Não deu para partilhar', 'Tenta outra vez daqui a nada.');
    }
  }

  return (
    <Screen>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.epoca}>
        {`Época ${seasonLabel(dados.seasonId)}`}
      </ThemedText>
      <ThemedText style={styles.titulo} accessibilityRole="header">
        {dados.headline}
      </ThemedText>
      <ThemedText>{dados.body}</ThemedText>
      <RecapStatsGrid stats={dados.stats} />
      <Button label="Partilhar" icon={icons.estrela} onPress={() => void partilhar()} />
      <ThemedText type="small" themeColor="textSecondary">
        Os números são contados a partir do que registaste na app. Os quilómetros são em linha reta, ida e volta,
        desde o estádio do teu clube da terra.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  epoca: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.two,
  },
  titulo: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 800,
  },
});
