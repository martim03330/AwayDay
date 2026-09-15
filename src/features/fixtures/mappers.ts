import type {
  ClubRow,
  FixtureCatalogRows,
  FixtureRow,
  MeetingPointRow,
  VenueRow,
} from '@/features/fixtures/types';
import type {
  Clube,
  Competicao,
  Divisao,
  Jogo,
  OrigemPontoEncontro,
  PontoEncontro,
  Regiao,
  RoofCoverage,
  Venue,
} from '@/mocks/tipos';

const MEETING_POINT_ORIGINS: Record<OrigemPontoEncontro, true> = { clube: true, camara: true, policia: true };

const publishedDate = new Intl.DateTimeFormat('pt-PT', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function isMeetingPointOrigin(value: string): value is OrigemPontoEncontro {
  return Object.prototype.hasOwnProperty.call(MEETING_POINT_ORIGINS, value);
}

function toMeetingPoint(row: MeetingPointRow): PontoEncontro | null {
  const origin = row.origin;
  if (!isMeetingPointOrigin(origin)) return null;
  return {
    nome: row.name,
    morada: row.address,
    horario: row.schedule,
    transporte: row.transport,
    nota: row.note,
    origem: origin,
    coordenadas:
      row.latitude !== null && row.longitude !== null
        ? { latitude: row.latitude, longitude: row.longitude }
        : null,
    publicadoPor: row.published_by,
    fonte: {
      titulo: row.source_title,
      url: row.source_url,
      publicadoEm: publishedDate.format(new Date(row.published_on)),
      // Published for this very fixture.
      jogoOriginal: null,
    },
  };
}

/** Fields the database does not have yet, joined by id. */
export type CatalogExtras = {
  fixtures: Readonly<Partial<Record<string, Pick<Jogo, 'meteorologia' | 'pontoEncontro'>>>>;
  venues: Readonly<
    Partial<Record<string, Pick<Venue, 'photoUrl' | 'hasShade' | 'hasShelter' | 'transportes'>>>
  >;
  clubs: Readonly<Partial<Record<string, Pick<Clube, 'adeptosNaApp'>>>>;
};

/** Preferred order of venues and clubs (ids); anything not listed goes last, by name. */
export type CatalogOrder = { venues: readonly string[]; clubs: readonly string[] };

export type FixtureCatalog = {
  competitionNames: Partial<Record<Competicao, string>>;
  venues: Venue[];
  clubs: Clube[];
  fixtures: Jogo[];
  /** Rows left out because required data is missing, as `kind:id`. */
  skipped: string[];
};

const COMPETITIONS: Record<Competicao, true> = {
  liga: true,
  'liga-2': true,
  'liga-3': true,
  'taca-de-portugal': true,
  'taca-da-liga': true,
  champions: true,
  'liga-europa': true,
  conference: true,
};

const ROOF_COVERAGES: Record<RoofCoverage, true> = { total: true, parcial: true, nenhuma: true };

const REGIONS = new Map<string, Regiao>([
  ['mainland', 'continente'],
  ['madeira', 'madeira'],
  ['azores', 'acores'],
  ['abroad', 'estrangeiro'],
]);

function hasKey<T extends object>(record: T, key: string): key is Extract<keyof T, string> {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function toDivision(tier: number | null): Divisao | null | undefined {
  if (tier === null) return null;
  return tier === 1 || tier === 2 || tier === 3 ? tier : undefined;
}

function toVenue(
  row: VenueRow,
  homeClubId: string | undefined,
  extras: CatalogExtras['venues']
): Venue | null {
  const region = REGIONS.get(row.region);
  // Capacity and coordinates are required by the stadium card, the distance and the map.
  if (!region || !homeClubId || row.capacity === null || row.latitude === null || row.longitude === null) {
    return null;
  }
  const extra = extras[row.id];
  const roofCoverage =
    row.roof_coverage !== null && hasKey(ROOF_COVERAGES, row.roof_coverage) ? row.roof_coverage : null;
  return {
    id: row.id,
    nome: row.name,
    cidade: row.city,
    pais: row.country,
    capacidade: row.capacity,
    clubeId: homeClubId,
    regiao: region,
    coordenadas: { latitude: row.latitude, longitude: row.longitude },
    // Stadiums without these details still show up; the screens hide what is unknown.
    photoUrl: row.photo_url ?? extra?.photoUrl ?? null,
    fotoCredito:
      row.photo_url && row.photo_license && row.photo_source_url
        ? { autor: row.photo_author ?? null, licenca: row.photo_license, url: row.photo_source_url }
        : null,
    roofCoverage,
    hasShade: extra?.hasShade ?? null,
    hasShelter: extra?.hasShelter ?? null,
    transportes: extra?.transportes ?? [],
  };
}

function toClub(
  row: ClubRow,
  venueIds: ReadonlySet<string>,
  extras: CatalogExtras['clubs']
): Clube | null {
  const division = toDivision(row.tier);
  if (division === undefined) return null;
  // Portuguese clubs need their stadium. Foreign clubs that only visit Portugal may have none.
  const hasVenue = row.home_venue_id !== null && venueIds.has(row.home_venue_id);
  if (!hasVenue && (row.country === 'Portugal' || row.home_venue_id !== null)) return null;
  return {
    id: row.id,
    nome: row.name,
    nomeCurto: row.short_name,
    sigla: row.abbreviation,
    pais: row.country,
    cores: { primaria: row.primary_color, secundaria: row.secondary_color },
    divisao: division,
    adeptosNaApp: extras[row.id]?.adeptosNaApp ?? 0,
    estadioId: hasVenue ? row.home_venue_id : null,
  };
}

function toFixture(
  row: FixtureRow,
  extras: CatalogExtras['fixtures'],
  clubIds: ReadonlySet<string>,
  venueIds: ReadonlySet<string>,
  meetingPoints: ReadonlyMap<string, PontoEncontro>
): Jogo | null {
  const competition = row.competition_id;
  const extra = extras[row.id];
  if (
    !hasKey(COMPETITIONS, competition) ||
    !clubIds.has(row.home_club_id) ||
    !clubIds.has(row.away_club_id) ||
    !venueIds.has(row.venue_id)
  ) {
    return null;
  }
  return {
    id: row.id,
    competicao: competition,
    fase: row.stage,
    casaId: row.home_club_id,
    foraId: row.away_club_id,
    estadioId: row.venue_id,
    // Postgres returns "+00:00"; the app works with the "Z" form of ISO 8601.
    inicio: new Date(row.kickoff_at).toISOString(),
    horaConfirmada: row.kickoff_confirmed ?? true,
    meteorologia: extra?.meteorologia ?? null,
    pontoEncontro: extra?.pontoEncontro ?? meetingPoints.get(row.id) ?? null,
  };
}

function collect<Row extends { id: string }, Item>(
  rows: readonly Row[],
  kind: string,
  map: (row: Row) => Item | null,
  skipped: string[]
) {
  const items: Item[] = [];
  for (const row of rows) {
    const item = map(row);
    if (item === null) skipped.push(`${kind}:${row.id}`);
    else items.push(item);
  }
  return items;
}

function sortByOrder<Item extends { id: string; nome: string }>(
  items: Item[],
  order: readonly string[]
) {
  const position = new Map(order.map((id, index) => [id, index]));
  return items.sort((a, b) => {
    const pa = position.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const pb = position.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return pa - pb || a.nome.localeCompare(b.nome, 'pt');
  });
}

/**
 * Turns database rows into the app's domain types. Pure: no I/O.
 * Rows missing data the screens require are skipped (and listed) instead of breaking the app.
 */
export function buildFixtureCatalog(
  rows: FixtureCatalogRows,
  extras: CatalogExtras,
  order: CatalogOrder
): FixtureCatalog {
  const skipped: string[] = [];

  const homeClubByVenue = new Map<string, string>();
  for (const club of rows.clubs) {
    if (club.home_venue_id && !homeClubByVenue.has(club.home_venue_id)) {
      homeClubByVenue.set(club.home_venue_id, club.id);
    }
  }

  const candidateVenues = collect(
    rows.venues,
    'venue',
    (row) => toVenue(row, homeClubByVenue.get(row.id), extras.venues),
    skipped
  );
  const candidateVenueIds = new Set(candidateVenues.map((venue) => venue.id));
  const clubs = collect(
    rows.clubs,
    'club',
    (row) => toClub(row, candidateVenueIds, extras.clubs),
    skipped
  );
  const clubIds = new Set(clubs.map((club) => club.id));

  const venues = candidateVenues.filter((venue) => {
    if (clubIds.has(venue.clubeId)) return true;
    skipped.push(`venue:${venue.id}`);
    return false;
  });
  const venueIds = new Set(venues.map((venue) => venue.id));

  const meetingPoints = new Map<string, PontoEncontro>();
  for (const row of rows.meetingPoints ?? []) {
    const ponto = toMeetingPoint(row);
    if (ponto) meetingPoints.set(row.fixture_id, ponto);
  }

  const fixtures = collect(
    rows.fixtures,
    'fixture',
    (row) => toFixture(row, extras.fixtures, clubIds, venueIds, meetingPoints),
    skipped
  ).sort((a, b) => a.inicio.localeCompare(b.inicio));

  const competitionNames: Partial<Record<Competicao, string>> = {};
  for (const competition of rows.competitions) {
    if (hasKey(COMPETITIONS, competition.id)) competitionNames[competition.id] = competition.name;
  }

  return {
    competitionNames,
    venues: sortByOrder(venues, order.venues),
    clubs: sortByOrder(clubs, order.clubs),
    fixtures,
    skipped,
  };
}
