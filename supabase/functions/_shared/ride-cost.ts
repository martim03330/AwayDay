// What a ride costs and what each person pays. Pure integer maths in cents, shared by the `rides` Edge Function (the
// server computes every ride's cost) and the app's tests. No imports, so both Deno and Node can load it.
//
// Units, all integers:
// - distances in metres;
// - consumption in centilitres per 100 km (6,5 L/100 km = 650);
// - fuel price in thousandths of a euro per litre (1,729 €/L = 1729);
// - money in cents.

export type TollRate = {
  /** Motorway reference as OpenStreetMap writes it without spaces ("A1"), or "default" for any other toll road. */
  motorway: string;
  /** Class 1 price of the reference trip, in cents (A1 Lisboa–Porto: 2505). */
  referenceCents: number;
  /** Tolled metres of that trip, as measured on the same router. */
  referenceM: number;
};

/** Tolled distance on one motorway along a route. */
export type TollSegment = { motorway: string; tollM: number };

export type TripInput = {
  distanceM: number;
  tollSegments: readonly TollSegment[];
  /** An electric car: only the tolls are shared (charging is the driver's, often free or at home). */
  electric?: boolean;
  /** Ignored for an electric car. */
  consumptionClPer100Km: number;
  /** Ignored for an electric car. */
  fuelPriceMilliPerLitre: number;
  /** The driver comes back too: fuel and tolls count twice. */
  roundTrip: boolean;
};

export type TripCost = { fuelCents: number; tollCents: number; totalCents: number };

function wholeNonNegative(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a whole number of at least 0, got ${value}.`);
  }
  return value;
}

/** a / b rounded half up, for non-negative integers. */
function divideRounded(a: number, b: number) {
  return Math.floor((2 * a + b) / (2 * b));
}

/** Fuel for one way, in cents: metres × centilitres/100 km × thousandths of a euro/litre ÷ 10^8. */
export function fuelCents(
  distanceM: number,
  consumptionClPer100Km: number,
  fuelPriceMilliPerLitre: number
) {
  const numerator =
    wholeNonNegative(distanceM, 'distanceM') *
    wholeNonNegative(consumptionClPer100Km, 'consumptionClPer100Km') *
    wholeNonNegative(fuelPriceMilliPerLitre, 'fuelPriceMilliPerLitre');
  if (!Number.isSafeInteger(numerator)) throw new RangeError('Fuel cost is out of range.');
  return divideRounded(numerator, 100_000_000);
}

/**
 * The rate a motorway is charged at: its own, else its main road's for a branch ("A13-1" → "A13"), else "default".
 */
export function rateKeyOf(motorway: string, rates: readonly TollRate[]) {
  if (rates.some((rate) => rate.motorway === motorway)) return motorway;
  const main = /^(A\d+)-\d+$/.exec(motorway)?.[1];
  if (main && rates.some((rate) => rate.motorway === main)) return main;
  return 'default';
}

/**
 * Tolls for one way, in cents. Metres are added up per motorway before rounding, so a motorway split into many
 * pieces by the router costs the same as in one piece. Motorways without their own rate use their main road's (for a
 * branch) or "default".
 */
export function tollCents(segments: readonly TollSegment[], rates: readonly TollRate[]) {
  const byMotorway = new Map<string, number>();
  for (const segment of segments) {
    const tollM = wholeNonNegative(segment.tollM, 'tollM');
    const key = rateKeyOf(segment.motorway, rates);
    byMotorway.set(key, (byMotorway.get(key) ?? 0) + tollM);
  }
  let total = 0;
  for (const [motorway, tollM] of byMotorway) {
    if (tollM === 0) continue;
    const rate = rates.find((candidate) => candidate.motorway === motorway);
    if (!rate) throw new RangeError(`No toll rate for ${motorway} and no default rate.`);
    const referenceCents = wholeNonNegative(rate.referenceCents, 'referenceCents');
    const referenceM = wholeNonNegative(rate.referenceM, 'referenceM');
    if (referenceM === 0) throw new RangeError(`Toll rate for ${motorway} has no distance.`);
    total += divideRounded(tollM * referenceCents, referenceM);
  }
  return total;
}

/** Fuel and tolls for the whole trip (both ways when it is a round trip). */
export function tripCost(input: TripInput, rates: readonly TollRate[]): TripCost {
  const ways = input.roundTrip ? 2 : 1;
  const fuel = input.electric
    ? 0
    : fuelCents(input.distanceM, input.consumptionClPer100Km, input.fuelPriceMilliPerLitre) * ways;
  const tolls = tollCents(input.tollSegments, rates) * ways;
  return { fuelCents: fuel, tollCents: tolls, totalCents: fuel + tolls };
}

/**
 * What each person pays when `people` share the trip (the driver included). Rounded up to the cent, so the driver
 * never pays more than a share; the few cents over are theirs.
 */
export function sharePerPersonCents(totalCents: number, people: number) {
  wholeNonNegative(totalCents, 'totalCents');
  if (!Number.isSafeInteger(people) || people < 1) {
    throw new RangeError(`people must be a whole number of at least 1, got ${people}.`);
  }
  return Math.floor((totalCents + people - 1) / people);
}

/** The price per person with the driver alone and then with each seat taken: [driver alone, +1, +2, …]. */
export function priceLadder(totalCents: number, seatsOffered: number) {
  if (!Number.isSafeInteger(seatsOffered) || seatsOffered < 1) {
    throw new RangeError(`seatsOffered must be a whole number of at least 1, got ${seatsOffered}.`);
  }
  return Array.from({ length: seatsOffered + 1 }, (_, taken) =>
    sharePerPersonCents(totalCents, taken + 1)
  );
}

/**
 * What a seat home costs someone who missed their transport: half the trip — the way back — split between everyone
 * in the car on the way home (the driver included), rounded up to the cent. The same rule lives in
 * `ride_return_share_cents` in the database, which is what actually charges people.
 */
export function returnShareCents(totalCents: number, people: number) {
  wholeNonNegative(totalCents, 'totalCents');
  if (!Number.isSafeInteger(people) || people < 1) {
    throw new RangeError(`people must be a whole number of at least 1, got ${people}.`);
  }
  return sharePerPersonCents(Math.floor((totalCents + 1) / 2), people);
}
