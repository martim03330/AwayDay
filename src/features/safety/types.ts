/** A safety note for visiting fans at a stadium (derbies only). Always sourced; areas, never businesses or people. */
export type SafetyNote = {
  id: string;
  venueId: string;
  /** `null` when it applies to any visiting fan. */
  visitingClubId: string | null;
  kind: 'indicacao_oficial' | 'zona_a_evitar';
  title: string;
  description: string;
  point: { latitude: number; longitude: number } | null;
  radiusM: number | null;
  /** YYYY-MM-DD: when it happened (zones) or when the arrangement was used (official notes). */
  referenceDate: string;
  sources: { title: string; url: string; date: string | null }[];
};
