import { useRouter } from 'expo-router';

import { EntrarComoGestor } from '@/features/casas/components/EntrarComoGestor';
import { Screen } from '@/ui/screen';

/** A manager's invite code for a Casa. */
export default function EntrarComoGestorScreen() {
  const router = useRouter();

  return (
    <Screen>
      <EntrarComoGestor
        onEntrou={(casaId) => router.replace({ pathname: '/casa/[casaId]', params: { casaId } })}
        onVoltar={() => router.back()}
      />
    </Screen>
  );
}
