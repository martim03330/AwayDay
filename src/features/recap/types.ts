export type RecapStats = {
  games: number;
  stadiums: number;
  newVenues: number;
  /** Round trips in a straight line from the hometown club's stadium; `null` without one. */
  km: number | null;
  places: number;
  topPlace: { name: string; visits: number } | null;
  averageScore: number | null;
  topDistrict: string | null;
};

export type SeasonRecap = {
  id: string;
  seasonId: string;
  headline: string;
  body: string;
  stats: RecapStats;
  createdAt: string;
  sharedAt: string | null;
};
