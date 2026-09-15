import { usePlaceCatalogSync } from '@/features/places/hooks/usePlaceCatalog';

/** Mounted once at the root to keep the places fresh. Renders nothing. */
export function PlaceCatalogSync() {
  usePlaceCatalogSync();
  return null;
}
