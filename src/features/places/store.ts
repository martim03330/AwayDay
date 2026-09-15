import { buildPlaceCatalog } from '@/features/places/mappers';
import type { PlaceCatalogRows } from '@/features/places/types';
import type { Local } from '@/mocks/tipos';

type Listener = (places: readonly Local[]) => void;

let realPlaces: readonly Local[] = [];
let hasRealPlaces = false;
let demoPlaces: readonly Local[] = [];
let demoActive = false;
const listeners = new Set<Listener>();

function current() {
  return demoActive ? demoPlaces : realPlaces;
}

function notify() {
  const places = current();
  for (const listener of listeners) listener(places);
}

/** Calls `listener` right away and after every change. Returns the unsubscribe function. */
export function subscribeToPlaces(listener: Listener) {
  listeners.add(listener);
  listener(current());
  return () => {
    listeners.delete(listener);
  };
}

/** The fictional places shown in demo mode. */
export function registerDemoPlaces(places: readonly Local[]) {
  demoPlaces = places;
  if (demoActive) notify();
}

/** Switches between demo and real places. Call it in the same moment demo mode changes, not in an effect. */
export function setDemoPlacesActive(active: boolean) {
  if (demoActive === active) return;
  demoActive = active;
  notify();
}

export function hasAppliedRealPlaces() {
  return hasRealPlaces;
}

/** Replaces the real places with rows from Supabase. */
export function applyPlaceCatalogRows(rows: PlaceCatalogRows) {
  realPlaces = buildPlaceCatalog(rows);
  hasRealPlaces = true;
  if (!demoActive) notify();
}
