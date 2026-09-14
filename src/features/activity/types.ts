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
