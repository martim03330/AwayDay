import type { DishRow, PlaceCatalogRows, PlaceRow, PlaceScoreRow } from '@/features/places/types';
import { horarioEmPortugues } from '@/lib/horario-osm';
import type { Local, Nota, Prato, TipoLocal } from '@/mocks/tipos';

const KINDS: Record<TipoLocal, true> = {
  tasca: true,
  cervejaria: true,
  bar: true,
  roulotte: true,
  churrasqueira: true,
  restaurante: true,
  cafe: true,
};

function isKind(value: string): value is TipoLocal {
  return Object.prototype.hasOwnProperty.call(KINDS, value);
}

function toPriceLevel(value: number | null): Local['precoMedio'] {
  return value === 1 || value === 2 || value === 3 ? value : null;
}


/** The researched sources, as stored ([{ url, title, published }]); anything malformed is dropped. */
function toSources(value: PlaceRow['matchday_sources']) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
    const url = item.url;
    const title = item.title;
    return typeof url === 'string' && url.startsWith('https://')
      ? [{ url, titulo: typeof title === 'string' && title ? title : url }]
      : [];
  });
}

/** A fans' average (e.g. 4.3) as a 1-5 score for the meters. */
function toNota(average: number | null): Nota | null {
  if (average === null) return null;
  const rounded = Math.round(average);
  return rounded <= 1 ? 1 : rounded === 2 ? 2 : rounded === 3 ? 3 : rounded === 4 ? 4 : 5;
}

function toDish(row: DishRow): Prato {
  return {
    id: row.id,
    nome: row.name,
    precoCentimos: row.price_cents,
    minutosPreparacao: row.prep_minutes,
    temperatura: row.temperature === 'hot' ? 'quente' : row.temperature === 'cold' ? 'fria' : null,
    especialidade: row.is_specialty,
    recomendacoes: row.recommendations_count,
    moeda: row.currency,
    fonte:
      row.source_url && row.checked_on
        ? { url: row.source_url, verificadoEm: row.checked_on }
        : null,
  };
}

function toPlace(row: PlaceRow, dishes: Prato[], score: PlaceScoreRow | undefined): Local | null {
  if (!isKind(row.kind) || row.latitude === null || row.longitude === null) return null;
  const confirmacao =
    row.confirmation === 'confirmed'
      ? 'confirmado'
      : row.confirmation === 'suggested'
        ? 'sugerido'
        : null;
  if (!confirmacao) return null;
  return {
    id: row.id,
    nome: row.name,
    tipo: row.kind,
    estadioId: row.venue_id,
    distanciaMetros: row.distance_m,
    minutosAPe: row.walking_minutes,
    coordenadas: { latitude: row.latitude, longitude: row.longitude },
    // From the research; unknown counts as not.
    homeFanHeavy: row.home_fans_heavy === true,
    clubesAqui: [],
    pratos: dishes,
    cervejometro: toNota(score?.beer_score ?? null),
    petiscometro: toNota(score?.food_score ?? null),
    pessoasAqui: null,
    especialidade: row.specialty,
    horario: horarioEmPortugues(row.opening_hours),
    precoMedio: toPriceLevel(row.price_level),
    notas: [],
    confirmacao,
    rapidoEBarato: row.quick_and_cheap,
    pontuacaoSugestao: row.suitability,
    votos: { sim: row.votes_yes, nao: row.votes_no },
    referencia: (() => {
      const fontes = toSources(row.matchday_sources);
      return row.matchday_note && fontes.length > 0 ? { nota: row.matchday_note, fontes } : null;
    })(),
    wcNoTasco: { sim: row.toilet_yes, nao: row.toilet_no },
    foto:
      row.photo_url && row.photo_license && row.photo_source_url
        ? {
            url: row.photo_url,
            autor: row.photo_author,
            licenca: row.photo_license,
            fonte: row.photo_source_url,
          }
        : null,
  };
}

/** Database rows to the app's places, nearest first. Pure: no I/O. Rows the screens cannot show are skipped. */
export function buildPlaceCatalog(rows: PlaceCatalogRows): Local[] {
  const dishesByPlace = new Map<string, Prato[]>();
  for (const row of rows.dishes) {
    const list = dishesByPlace.get(row.place_id) ?? [];
    list.push(toDish(row));
    dishesByPlace.set(row.place_id, list);
  }

  const scoreByPlace = new Map(rows.scores.map((row) => [row.place_id, row]));

  return rows.places
    .flatMap((row) => {
      const place = toPlace(row, dishesByPlace.get(row.id) ?? [], scoreByPlace.get(row.id));
      return place ? [place] : [];
    })
    .sort((a, b) => a.distanciaMetros - b.distanciaMetros);
}
