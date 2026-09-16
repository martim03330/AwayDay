import { skipToken, useQuery } from '@tanstack/react-query';

import { PassaporteCard } from '@/components/passaporte-card';
import { fetchMyStamps } from '@/features/stamps/api';
import { useUserId } from '@/lib/session';
import { useAppState } from '@/state/app-state';
import { Screen } from '@/ui/screen';

/** Every stamp, grouped by league. The profile only shows a summary. */
export default function PassaporteScreen() {
  const { estadiosVisitados, avaliacoes } = useAppState();
  const userId = useUserId();
  const carimbos = useQuery({
    queryKey: ['stamps', userId],
    queryFn: userId ? fetchMyStamps : skipToken,
    meta: { persist: false },
  });

  return (
    <Screen>
      <PassaporteCard
        estadiosVisitados={estadiosVisitados}
        verificados={(carimbos.data ?? []).map((carimbo) => carimbo.venueId)}
        avaliacoes={avaliacoes}
      />
    </Screen>
  );
}
