export type RoutePoint = { latitude: number; longitude: number };

export type WalkingRoute = {
  distanceM: number;
  durationS: number;
  /** The route line, latitude first. */
  path: RoutePoint[];
  steps: { instruction: string; distanceM: number }[];
  attribution: string;
};

export type RouteRefusal = 'too-far' | 'no-route' | 'rate-limited';

export class RouteRefused extends Error {
  readonly reason: RouteRefusal;

  constructor(reason: RouteRefusal) {
    super(reason);
    this.name = 'RouteRefused';
    this.reason = reason;
  }
}
