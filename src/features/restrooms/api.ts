import { horarioEmPortugues } from '@/lib/horario-osm';
import { supabase } from '@/lib/supabase';
import type { Restroom } from '@/mocks/tipos';

// Real public toilets near a stadium, imported from OpenStreetMap. Unknown facts stay unknown (null).

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function fetchRestroomsNear(venueId: string): Promise<Restroom[]> {
  const { data, error } = await client()
    .from('restroom')
    .select('id, venue_id, name, latitude, longitude, fee, wheelchair, access, opening_hours')
    .eq('venue_id', venueId)
    .order('distance_m');
  if (error) throw error;
  return data.flatMap((row) =>
    row.latitude === null || row.longitude === null
      ? []
      : [
          {
            id: row.id,
            nome: row.name ?? 'Casa de banho pública',
            tipo: 'publica' as const,
            estadioId: row.venue_id,
            localId: null,
            coordenadas: { latitude: row.latitude, longitude: row.longitude },
            gratuita: row.fee === 'no' ? true : row.fee === 'yes' ? false : null,
            precoEuros: 0,
            acessivel:
              row.wheelchair === 'yes' || row.wheelchair === 'limited'
                ? true
                : row.wheelchair === 'no'
                  ? false
                  : null,
            acesso:
              row.access === 'public'
                ? ('livre' as const)
                : row.access === 'customers'
                  ? ('clientes' as const)
                  : ('desconhecido' as const),
            horario: null,
            horarioTexto: horarioEmPortugues(row.opening_hours),
            nota: '',
            fonte: 'osm' as const,
          },
        ]
  );
}
