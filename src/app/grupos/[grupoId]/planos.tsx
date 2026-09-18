import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { CartaoDoPlano } from '@/features/groups/components/CartaoDoPlano';
import { plansKey, useGroupFixturePlans } from '@/features/groups/hooks/useGroups';
import { useUserId } from '@/lib/session';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { ThemedText } from '@/ui/themed-text';

/**
 * Os planos em aberto do grupo: os jogos para onde alguém convidou a malta (aqui ou noutro grupo que mandou o plano
 * para cá). Os fechados ficam até ao jogo, para se ver quem vai.
 */
export default function PlanosDoGrupoScreen() {
  const router = useRouter();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { grupoId } = useLocalSearchParams<{ grupoId?: string }>();
  const planos = useGroupFixturePlans(grupoId ?? null);
  const lista = planos.data ?? [];

  return (
    <Screen refreshing={planos.isRefetching} onRefresh={() => void planos.refetch()}>
      {planos.isLoading ? (
        <ThemedText themeColor="textSecondary">A procurar os planos do grupo…</ThemedText>
      ) : lista.length === 0 ? (
        <Card>
          <ThemedText type="subtitle">Nada combinado… ainda</ThemedText>
          <ThemedText themeColor="textSecondary">
            Abre um jogo e toca em «Combinar com a malta». O convite cai na conversa, e daqui
            combina-se a boleia, a dormida e quem vai.
          </ThemedText>
          <Button
            label="Ver os jogos"
            icon={icons.jogos}
            onPress={() => router.navigate('/jogos')}
          />
        </Card>
      ) : (
        lista.map((plano) => (
          <CartaoDoPlano
            key={plano.id}
            plano={plano}
            quemConvidou={plano.createdBy === userId ? 'eu' : plano.creatorName.split(' ')[0]}
            onAbrir={() =>
              grupoId
                ? router.push({
                    pathname: '/grupos/[grupoId]/plano/[planoId]',
                    params: { grupoId, planoId: plano.id },
                  })
                : undefined
            }
            onRespondido={() => void queryClient.invalidateQueries({ queryKey: plansKey() })}
          />
        ))
      )}
    </Screen>
  );
}
