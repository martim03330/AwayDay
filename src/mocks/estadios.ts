import { subscribeToFixtureCatalog } from '@/features/fixtures/store';
import type { Venue } from '@/mocks/tipos';

// Venues now come from Supabase (src/features/fixtures). This module keeps the interface the
// screens already use: the exports below are filled in place whenever the catalogue changes.

export const estadios: Venue[] = [];

/** Portuguese venues only: foreign ones serve European fixtures and do not count for the passport. */
export const estadiosNacionais: Venue[] = [];

subscribeToFixtureCatalog((catalogo) => {
  estadios.splice(0, estadios.length, ...catalogo.venues);
  estadiosNacionais.splice(
    0,
    estadiosNacionais.length,
    ...catalogo.venues.filter((estadio) => estadio.pais === 'Portugal')
  );
});

export function obterEstadio(id: string) {
  return estadios.find((estadio) => estadio.id === id);
}
