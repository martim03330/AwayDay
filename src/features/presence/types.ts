/** Same limits as the `check-in` Edge Function, so the phone refuses early with the same rule. */
export const CHECK_IN_MAX_DISTANCE_M = 150;
export const CHECK_IN_MAX_ACCURACY_M = 100;

export type ClubPresence = { clubId: string; people: number };

/** Public aggregate for one place. The server only publishes it with at least 5 people. */
export type PlacePulse = {
  placeId: string;
  venueId: string;
  people: number;
  /** Only clubs with at least 5 people here. */
  clubs: ClubPresence[];
  /** People whose club has fewer than 5 here, or is unknown. */
  others: number;
  updatedAt: string;
};

export type DevicePosition = {
  latitude: number;
  longitude: number;
  /** Radius in metres; `null` when the phone does not say. */
  accuracy: number | null;
};

export type CheckInRecord = { visitId: string; visitedAt: string; expiresAt: string };

export type CheckInRefusal = 'too-far' | 'low-accuracy' | 'place-not-found' | 'rate-limited';

export class CheckInRefused extends Error {
  readonly reason: CheckInRefusal;
  /** Rounded to 50 m, only for `too-far`. */
  readonly distanceM: number | null;

  constructor(reason: CheckInRefusal, distanceM: number | null = null) {
    super(reason);
    this.name = 'CheckInRefused';
    this.reason = reason;
    this.distanceM = distanceM;
  }
}

/** One line of a ranking. Other people only appear when they chose to. */
export type RankingRow = {
  position: number;
  /** To open their profile from the table; absent where the table is not about people's profiles. */
  profileId?: string;
  isMe: boolean;
  displayName: string;
  clubId: string | null;
  /** Verified tascos, or the best noise level. */
  value: number;
};
