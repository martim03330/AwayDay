import { useFixtureCatalogSync } from '@/features/fixtures/hooks/useFixtureCatalog';

/** Mounted once at the root to keep the catalogue fresh. Renders nothing. */
export function FixtureCatalogSync() {
  useFixtureCatalogSync();
  return null;
}
