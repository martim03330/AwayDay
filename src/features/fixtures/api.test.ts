import { beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data: unknown[] | null; error: { message: string } | null };
type Call = { table: string; filters: unknown[][]; range?: [number, number] };

/** What each table answers, per page (`from` index). Tables missing here answer an empty page. */
let answers: Record<string, (from: number) => Result> = {};
let calls: Call[] = [];

/** A fake query builder: records the filters and answers from `answers` when awaited. */
function builder(table: string) {
  const call: Call = { table, filters: [] };
  calls.push(call);
  const chain = {
    select: () => chain,
    order: () => chain,
    gte: (...args: unknown[]) => {
      call.filters.push(['gte', ...args]);
      return chain;
    },
    range: (from: number, to: number) => {
      call.range = [from, to];
      return chain;
    },
    then: (resolve: (result: Result) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve((answers[table] ?? (() => ({ data: [], error: null })))(call.range?.[0] ?? 0)).then(
        resolve,
        reject
      ),
  };
  return chain;
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => builder(table) } }));

const { fetchFixtureCatalogRows, previousSeasonStart } = await import('@/features/fixtures/api');

const ok = (data: unknown[]): Result => ({ data, error: null });
const failed: Result = { data: null, error: { message: 'boom' } };
const fixture = (id: number) => ({ id: `f${id}`, kickoff_at: '2026-10-01T19:00:00Z' });

beforeEach(() => {
  calls = [];
  answers = {
    competition: () => ok([{ id: 'liga' }]),
    venue: () => ok([{ id: 'dragao' }]),
    club: () => ok([{ id: 'porto' }]),
    fixture: () => ok([fixture(1)]),
    fixture_meeting_point: () => ok([{ fixture_id: 'f1', name: 'Praça', fixture: { kickoff_at: 'x' } }]),
    fixture_weather: () => ok([{ fixture_id: 'f1', condition: 'sun', fixture: { kickoff_at: 'x' } }]),
  };
});

describe('previousSeasonStart', () => {
  it('is 1 July of the year before the current season', () => {
    expect(previousSeasonStart(new Date('2026-10-12T10:00:00Z'))).toBe('2025-07-01T00:00:00.000Z');
    expect(previousSeasonStart(new Date('2026-07-01T00:00:00Z'))).toBe('2025-07-01T00:00:00.000Z');
    expect(previousSeasonStart(new Date('2026-06-30T23:59:59Z'))).toBe('2024-07-01T00:00:00.000Z');
  });
});

describe('fetchFixtureCatalogRows', () => {
  it('returns the catalogue without the joined fixture on meeting points and weather', async () => {
    const rows = await fetchFixtureCatalogRows(new Date('2026-10-12T10:00:00Z'));
    expect(rows).toEqual({
      competitions: [{ id: 'liga' }],
      venues: [{ id: 'dragao' }],
      clubs: [{ id: 'porto' }],
      fixtures: [fixture(1)],
      meetingPoints: [{ fixture_id: 'f1', name: 'Praça' }],
      weather: [{ fixture_id: 'f1', condition: 'sun' }],
    });
  });

  it('only asks for fixtures (and their extras) from the start of the previous season', async () => {
    await fetchFixtureCatalogRows(new Date('2026-10-12T10:00:00Z'));
    const since = '2025-07-01T00:00:00.000Z';
    const filtersOf = (table: string) => calls.find((call) => call.table === table)?.filters;
    // Fixtures are all fetched (history needs old ones); only meeting points and weather are recent.
    expect(filtersOf('fixture')).toEqual([]);
    expect(filtersOf('fixture_meeting_point')).toEqual([['gte', 'fixture.kickoff_at', since]]);
    expect(filtersOf('fixture_weather')).toEqual([['gte', 'fixture.kickoff_at', since]]);
  });

  it('reads every page and concatenates them', async () => {
    const all = Array.from({ length: 2300 }, (_, index) => fixture(index));
    answers.fixture = (from) => ok(all.slice(from, from + 1000));
    const rows = await fetchFixtureCatalogRows();
    expect(rows.fixtures).toHaveLength(2300);
    expect(rows.fixtures[1000]).toEqual(fixture(1000));
    expect(calls.filter((call) => call.table === 'fixture').map((call) => call.range)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('asks for one more page when a page is exactly full', async () => {
    const all = Array.from({ length: 1000 }, (_, index) => fixture(index));
    answers.fixture = (from) => ok(all.slice(from, from + 1000));
    const rows = await fetchFixtureCatalogRows();
    expect(rows.fixtures).toHaveLength(1000);
    expect(calls.filter((call) => call.table === 'fixture')).toHaveLength(2);
  });

  it('still returns the catalogue when meeting points or weather fail', async () => {
    answers.fixture_meeting_point = () => failed;
    answers.fixture_weather = () => failed;
    const rows = await fetchFixtureCatalogRows();
    expect(rows.fixtures).toEqual([fixture(1)]);
    expect(rows.meetingPoints).toEqual([]);
    expect(rows.weather).toEqual([]);
  });

  it('drops an optional table whose later page fails', async () => {
    answers.fixture_weather = (from) =>
      from === 0 ? ok(Array.from({ length: 1000 }, (_, index) => ({ fixture_id: `f${index}` }))) : failed;
    const rows = await fetchFixtureCatalogRows();
    expect(rows.weather).toEqual([]);
    expect(rows.fixtures).toEqual([fixture(1)]);
  });

  it.each(['competition', 'venue', 'club', 'fixture'])('throws when the core table %s fails', async (table) => {
    answers[table] = () => failed;
    await expect(fetchFixtureCatalogRows()).rejects.toEqual({ message: 'boom' });
  });
});
