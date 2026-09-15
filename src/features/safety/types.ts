/** A safety note for visiting fans at a stadium. Always sourced; areas and public premises, never people. */
export type SafetyNote = {
  id: string;
  venueId: string;
  /** `null` when it applies to any visiting fan. */
  visitingClubId: string | null;
  /**
   * indicacao_oficial: how police organised visitors in a derby; zona_a_evitar: area with incidents (map circle);
   * zona_adeptos_casa: stands, gates or areas home supporters hold; percurso_visitantes: official route or entrance.
   */
  kind: 'indicacao_oficial' | 'zona_a_evitar' | 'zona_adeptos_casa' | 'percurso_visitantes';
  title: string;
  description: string;
  point: { latitude: number; longitude: number } | null;
  radiusM: number | null;
  /** YYYY-MM-DD: when it happened (zones) or when the arrangement was used (official notes). */
  referenceDate: string;
  sources: { title: string; url: string; date: string | null }[];
};
