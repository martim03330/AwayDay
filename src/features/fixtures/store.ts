import { buildFixtureCatalog, type FixtureCatalog } from '@/features/fixtures/mappers';
import { bundledCatalogRows } from '@/features/fixtures/snapshot';
import type { FixtureCatalogRows } from '@/features/fixtures/types';
import { extrasClubes } from '@/mocks/extras-clubes';
import { extrasEstadios } from '@/mocks/extras-estadios';
import { extrasJogos } from '@/mocks/extras-jogos';

type Listener = (catalog: FixtureCatalog) => void;

const extras = { fixtures: extrasJogos, venues: extrasEstadios, clubs: extrasClubes };
// Lists keep the order people already know from the bundled catalogue.
const order = {
  venues: bundledCatalogRows.venues.map((row) => row.id),
  clubs: bundledCatalogRows.clubs.map((row) => row.id),
};

let current = buildFixtureCatalog(bundledCatalogRows, extras, order);
const listeners = new Set<Listener>();

export function getFixtureCatalog() {
  return current;
}

/** Calls `listener` right away and after every change. Returns the unsubscribe function. */
export function subscribeToFixtureCatalog(listener: Listener) {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Replaces the catalogue with rows from Supabase. A result with no venues, clubs or fixtures is
 * ignored, so a bad response never leaves the app empty. Returns whether the catalogue changed.
 */
export function applyFixtureCatalogRows(rows: FixtureCatalogRows) {
  const next = buildFixtureCatalog(rows, extras, order);
  if (next.venues.length === 0 || next.clubs.length === 0 || next.fixtures.length === 0) {
    return false;
  }
  current = next;
  for (const listener of listeners) listener(current);
  return true;
}
