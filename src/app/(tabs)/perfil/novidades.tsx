import { useEffect } from 'react';

import { NudgeList } from '@/features/nudges/components/NudgeList';
import { useMarkNudgesRead, useMyNudges } from '@/features/nudges/hooks/useMyNudges';
import { useUserId } from '@/lib/session';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

export default function NovidadesScreen() {
  const userId = useUserId();
  const novidades = useMyNudges(userId);
  const marcarLidas = useMarkNudgesRead(userId);
  const temPorLer = novidades.data?.some((nudge) => nudge.readAt === null) ?? false;

  // Ao abrir o ecrã, as novidades passam a lidas.
  useEffect(() => {
    if (temPorLer && !marcarLidas.isPending && !marcarLidas.isSuccess) marcarLidas.mutate();
  }, [temPorLer, marcarLidas]);

  if (!userId) {
    return (
      <Screen>
        <Card>
          <EmptyState
            icon={icons.perfil}
            title="Precisas de conta"
            message="As novidades ficam guardadas na tua conta. Cria uma ou entra no Perfil."
          />
        </Card>
      </Screen>
    );
  }

  if (novidades.isPending) {
    return (
      <Screen>
        <SkeletonCard lines={3} />
      </Screen>
    );
  }

  if (novidades.isError) {
    return (
      <Screen>
        <Card>
          <EmptyState
            icon={icons.aviso}
            title="Não deu para carregar"
            message="Verifica a ligação e tenta outra vez."
            action={{ label: 'Tentar outra vez', onPress: () => void novidades.refetch() }}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen refreshing={novidades.isRefetching} onRefresh={() => void novidades.refetch()}>
      <NudgeList nudges={novidades.data} />
      <ThemedText type="small" themeColor="textSecondary">
        Dicas a partir do calendário de jogos e do que já fizeste na app. Desligas em Perfil → Notificações.
      </ThemedText>
    </Screen>
  );
}
