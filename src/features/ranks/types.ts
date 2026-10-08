/** 1 is the top division, 5 is where everyone starts. */
export type Division = 1 | 2 | 3 | 4 | 5;

/** Compared with last season: 1 promoted, -1 relegated. */
export type DivisionMovement = -1 | 0 | 1;

export type LeaderboardScope = 'geral' | 'amigos' | 'clube' | 'divisao';
export type LeaderboardPeriod = 'epoca' | 'sempre';

/** The caller's own numbers. Everything here is computed by the server. */
export type MyRanking = {
  totalXp: number;
  level: number;
  /** XP at which the current level started. */
  levelXp: number;
  /** XP needed for the next level. */
  nextLevelXp: number;
  /** `null` between seasons. */
  seasonId: string | null;
  seasonXp: number;
  division: Division;
  divisionMovement: DivisionMovement;
  divisionPosition: number;
  divisionSize: number;
  /** How many go up and down at the end of the season, counting people who scored. */
  promotionSpots: number;
  relegationSpots: number;
  /** Going up also needs this many points in the season. */
  promotionMinXp: number;
  /** Weeks with games in a row with a stadium stamped. Weeks without games do not break it. */
  streakWeeks: number;
  bestStreakWeeks: number;
  stadiums: number;
  stadiumVisits: number;
  showInRankings: boolean;
};

export type LeaderboardRow = {
  position: number;
  isMe: boolean;
  displayName: string;
  clubId: string | null;
  level: number;
  xp: number;
  division: Division;
};

export type MissionKind = 'achievement' | 'season' | 'weekly';

export type Mission = {
  id: string;
  kind: MissionKind;
  /** Tiers of the same achievement share it. */
  family: string;
  /** 1 bronze, 2 silver, 3 gold; `null` for single missions. */
  tier: 1 | 2 | 3 | null;
  /** What counts towards it (the catalogue's metric): picks the how-to guide. */
  metric: string;
  /** True for missions proven by a photo taken on the day. */
  needsProofPhoto: boolean;
  target: number;
  xp: number;
  title: string;
  description: string;
  badge: string | null;
  /** A name from the app's icon set; the screen falls back when it does not know it. */
  icon: string;
  proofHint: string | null;
  sort: number;
  /** Monday of the week, for weekly challenges. */
  weekStart: string | null;
  progress: number;
  completedAt: string | null;
};

export type VenueAttendance = { venueId: string; people: number; visits: number };
export type ClubAwaySupport = { clubId: string; people: number; visits: number };
export type SeasonAttendance = { people: number; visits: number; venues: number };
