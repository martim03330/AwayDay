import type { Venue } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';

/** O react-native-maps não funciona na web: mostramos só um aviso. */
export function MapaJogo({ venue }: { venue: Venue }) {
  return (
    <Card>
      <EmptyState
        icon={icons.cidade}
        title="Mapa só na app"
        message={`Abre a AwayDay no telemóvel para veres o ${venue.nome} e os tascos à volta.`}
      />
    </Card>
  );
}
