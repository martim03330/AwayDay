import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { CartaoDoPlano } from '@/features/groups/components/CartaoDoPlano';
import {
  plansKey,
  useGroupFixturePlans,
  usePlanConflicts,
} from '@/features/groups/hooks/useGroups';
import { useUserId } from '@/lib/session';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SkeletonCard } from '@/ui/skeleton';

/**
 * Os planos do grupo: os jogos para onde alguém convidou a malta (aqui ou noutro grupo que mandou o plano
 * para cá). Os fechados ficam até ao jogo, para se ver quem vai.
 */
export default function PlanosDoGrupoScreen() {
  const router = useRouter();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { grupoId } = useLocalSearchParams<{ grupoId?: string }>();
  const planos = useGroupFixturePlans(grupoId ?? null);
  const lista = planos.data ?? [];
  const conflitos = usePlanConflicts(lista.map((plano) => plano.id));

  return (
    <Screen refreshing={planos.isRefetching} onRefresh={() => void planos.refetch()}>
      {planos.isLoading ? (
        <>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={icons.calendario}
          title="Nada combinado… ainda"
          message="Abre um jogo e toca em «Combinar com a malta»."
          action={{ label: 'Ver os jogos', onPress: () => router.navigate('/jogos') }}
        />
      ) : (
        lista.map((plano) => (
          <CartaoDoPlano
            key={plano.id}
            plano={plano}
            vaisComOutroGrupo={conflitos.data?.[plano.id]}
            grupoAtualId={grupoId ?? null}
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
