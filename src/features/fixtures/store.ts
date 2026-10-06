import { aproximarDoPresente } from '@/features/fixtures/demo-datas';
import { buildFixtureCatalog, type FixtureCatalog } from '@/features/fixtures/mappers';
import { bundledCatalogRows } from '@/features/fixtures/snapshot';
import type { FixtureCatalogRows } from '@/features/fixtures/types';
import { extrasEstadios } from '@/mocks/extras-estadios';
import { extrasJogos } from '@/mocks/extras-jogos';

type Listener = (catalog: FixtureCatalog) => void;

/** Sample weather, shade, shelter, transport and meeting points: invented, so only ever for the demo catalogue. */
const demoExtras = { fixtures: extrasJogos, venues: extrasEstadios };
/** The real catalogue shows only what the database has; screens hide what is unknown. */
const realExtras = { fixtures: {}, venues: {} };
// Lists keep the order people already know from the bundled catalogue.
const order = {
  venues: bundledCatalogRows.venues.map((row) => row.id),
  clubs: bundledCatalogRows.clubs.map((row) => row.id),
};

/** Demo mode: the bundled catalogue, with its sample fixtures and simulated weather. */
const demoCatalog = buildFixtureCatalog(
  // Sample games moved forward to the coming days, so demo mode always has games to show.
  { ...bundledCatalogRows, fixtures: aproximarDoPresente(bundledCatalogRows.fixtures, Date.now()) },
  demoExtras,
  order
);
/** Real mode before the first answer from Supabase: bundled clubs and stadiums, and no sample fixtures. */
let realCatalog = buildFixtureCatalog({ ...bundledCatalogRows, fixtures: [] }, realExtras, order);
let hasRealCatalog = false;
let demoActive = false;
const listeners = new Set<Listener>();

function current() {
  return demoActive ? demoCatalog : realCatalog;
}

function notify() {
  const catalog = current();
  for (const listener of listeners) listener(catalog);
}

/** A sample fixture from the demo catalogue, whatever mode is on (demo data is built at load time). */
export function getDemoFixture(id: string) {
  return demoCatalog.fixtures.find((jogo) => jogo.id === id);
}

export function getFixtureCatalog() {
  return current();
}

/** Calls `listener` right away and after every change. Returns the unsubscribe function. */
export function subscribeToFixtureCatalog(listener: Listener) {
  listeners.add(listener);
  listener(current());
  return () => {
    listeners.delete(listener);
  };
}

/** Switches between the demo and the real catalogue. Call it in the same moment demo mode changes. */
export function setDemoFixturesActive(active: boolean) {
  if (demoActive === active) return;
  demoActive = active;
  notify();
}

export function hasAppliedRealFixtures() {
  return hasRealCatalog;
}

/**
 * Replaces the real catalogue with rows from Supabase. A result with no venues or clubs is ignored, so a bad
 * response never leaves the app without stadiums. No fixtures is a valid answer (nothing scheduled yet).
 * Returns whether the catalogue changed.
 */
export function applyFixtureCatalogRows(rows: FixtureCatalogRows) {
  const next = buildFixtureCatalog(rows, realExtras, order);
  if (next.venues.length === 0 || next.clubs.length === 0) return false;
  realCatalog = next;
  hasRealCatalog = true;
  if (!demoActive) notify();
  return true;
}
