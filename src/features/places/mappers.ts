import type { DishRow, PlaceCatalogRows, PlaceRow, PlaceScoreRow } from '@/features/places/types';
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

const OSM_WORDS: [RegExp, string][] = [
  [/\bMo\b/g, 'Seg'],
  [/\bTu\b/g, 'Ter'],
  [/\bWe\b/g, 'Qua'],
  [/\bTh\b/g, 'Qui'],
  [/\bFr\b/g, 'Sex'],
  [/\bSa\b/g, 'Sáb'],
  [/\bSu\b/g, 'Dom'],
  [/\bPH\b/g, 'feriados'],
  [/\boff\b/g, 'fechado'],
];

/** OpenStreetMap opening hours ("Mo-Fr 08:00-23:00; Su off") in Portuguese ("Seg-Sex 08:00-23:00; Dom fechado"). */
export function horarioEmPortugues(openingHours: string | null) {
  if (!openingHours) return null;
  if (openingHours.trim() === '24/7') return 'Sempre aberto';
  return OSM_WORDS.reduce(
    (texto, [padrao, palavra]) => texto.replace(padrao, palavra),
    openingHours
  );
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
      row.source_url && row.checked_on ? { url: row.source_url, verificadoEm: row.checked_on } : null,
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
    // Not known for real places until live presence exists.
    homeFanHeavy: false,
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
