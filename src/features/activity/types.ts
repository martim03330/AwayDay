export type AttendanceStatus = 'going' | 'attended';

export type PlaceVisitSource = 'check-in' | 'manual';

export type ReviewInput = {
  fixtureId: string;
  /** Scores from 1 to 5. */
  stadium: number;
  atmosphere: number;
  access: number;
  comment: string;
};

export type ReviewRecord = ReviewInput & {
  createdAt: string;
  updatedAt: string;
};

export type PlaceVisitRecord = {
  id: string;
  placeId: string;
  visitedAt: string;
  source: PlaceVisitSource;
};

export type NoiseMeasurementRecord = {
  id: string;
  fixtureId: string;
  /** 0 to 100 on the app's relative scale (not decibels). */
  level: number;
  measuredAt: string;
};

/** Why the server refused a noise reading. */
export type NoiseMeasurementRefusal = 'too-soon' | 'not-live' | 'needs-check-in';

export class NoiseMeasurementRefused extends Error {
  readonly reason: NoiseMeasurementRefusal;

  constructor(reason: NoiseMeasurementRefusal) {
    super(reason);
    this.name = 'NoiseMeasurementRefused';
    this.reason = reason;
  }
}
