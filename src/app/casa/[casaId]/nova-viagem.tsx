import { useLocalSearchParams, useRouter } from 'expo-router';

import { NovaViagem } from '@/features/casas/components/NovaViagem';
import { Screen } from '@/ui/screen';

/** A new trip of the Casa; once published it opens on its management screen. */
export default function NovaViagemScreen() {
  const { casaId } = useLocalSearchParams<{ casaId?: string }>();
  const router = useRouter();

  return (
    <Screen>
      {casaId ? (
        <NovaViagem
          casaId={casaId}
          onCriada={(viagemId) =>
            router.replace({ pathname: '/casa/viagem/[viagemId]/gerir', params: { viagemId } })
          }
        />
      ) : null}
    </Screen>
  );
}
