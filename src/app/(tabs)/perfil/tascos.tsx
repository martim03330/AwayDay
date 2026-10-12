import { useRouter } from 'expo-router';

import { HistoricoTascos } from '@/components/historico-tascos';
import { useAppState } from '@/state/app-state';
import { Screen } from '@/ui/screen';

/** The tascos you checked in at, newest first. Opened from the profile menu. */
export default function TascosVisitadosScreen() {
  const router = useRouter();
  const { visitasLocais } = useAppState();

  return (
    <Screen>
      <HistoricoTascos
        visitas={visitasLocais}
        onAbrirLocal={(localId) => router.push({ pathname: '/locais/[localId]', params: { localId } })}
      />
    </Screen>
  );
}
