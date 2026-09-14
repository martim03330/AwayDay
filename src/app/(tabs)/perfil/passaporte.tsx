import { PassaporteCard } from '@/components/passaporte-card';
import { useAppState } from '@/state/app-state';
import { Screen } from '@/ui/screen';

/** Every stamp, grouped by league. The profile only shows a summary. */
export default function PassaporteScreen() {
  const { estadiosVisitados, avaliacoes } = useAppState();

  return (
    <Screen>
      <PassaporteCard estadiosVisitados={estadiosVisitados} avaliacoes={avaliacoes} />
    </Screen>
  );
}
