import { describe, expect, it } from 'vitest';

import {
  fuelCents,
  priceLadder,
  returnShareCents,
  sharePerPersonCents,
  rateKeyOf,
  tollCents,
  tripCost,
  type TollRate,
} from '../../supabase/functions/_shared/ride-cost';

const RATES: TollRate[] = [
  { motorway: 'A1', referenceCents: 2505, referenceM: 270_000 },
  { motorway: 'default', referenceCents: 8, referenceM: 1000 },
];

describe('fuelCents', () => {
  it('100 km at 6,5 L/100 km and 1,729 €/L costs 11,24 €', () => {
    // 6,5 L × 1,729 € = 11,2385 €
    expect(fuelCents(100_000, 650, 1729)).toBe(1124);
  });

  it('rounds half a cent up and just under half a cent down', () => {
    // 1 km × 5 L/100 km × 1,000 €/L = 5 cents exactly
    expect(fuelCents(1000, 500, 1000)).toBe(5);
    // 0,05 L × 1,010 €/L = 5,05 cents -> 5
    expect(fuelCents(1000, 500, 1010)).toBe(5);
    // 0,05 L × 1,090 €/L = 5,45 cents -> 5; × 1,100 €/L = 5,5 cents -> 6
    expect(fuelCents(1000, 500, 1090)).toBe(5);
    expect(fuelCents(1000, 500, 1100)).toBe(6);
  });

  it('costs nothing without distance', () => {
    expect(fuelCents(0, 650, 1729)).toBe(0);
  });

  it('refuses fractions and negatives', () => {
    expect(() => fuelCents(100.5, 650, 1729)).toThrow(RangeError);
    expect(() => fuelCents(100_000, -1, 1729)).toThrow(RangeError);
    expect(() => fuelCents(100_000, 650, 1.729)).toThrow(RangeError);
  });

  it('refuses a product outside the safe integer range', () => {
    expect(() => fuelCents(Number.MAX_SAFE_INTEGER, 650, 1729)).toThrow(RangeError);
  });
});

describe('tollCents', () => {
  it('the whole reference trip costs the reference price', () => {
    expect(tollCents([{ motorway: 'A1', tollM: 270_000 }], RATES)).toBe(2505);
  });

  it('adds the pieces of a motorway before rounding', () => {
    // Three pieces of 1 km each: 2505 / 270 per km = 9,28 cents; rounded separately it would be 27, together 28.
    const pieces = [1000, 1000, 1000].map((tollM) => ({ motorway: 'A1', tollM }));
    expect(tollCents(pieces, RATES)).toBe(28);
  });

  it('uses the default rate for motorways without their own', () => {
    expect(tollCents([{ motorway: 'A8', tollM: 10_000 }], RATES)).toBe(80);
  });

  it('is zero without tolled metres', () => {
    expect(tollCents([], RATES)).toBe(0);
    expect(tollCents([{ motorway: 'A1', tollM: 0 }], RATES)).toBe(0);
  });

  it('refuses an unknown motorway when there is no default rate', () => {
    expect(() => tollCents([{ motorway: 'A8', tollM: 1000 }], [RATES[0]])).toThrow(RangeError);
  });

  it('charges a branch at its main motorway\'s rate, adding it to the main road before rounding', () => {
    expect(tollCents([{ motorway: 'A1-1', tollM: 270_000 }], RATES)).toBe(2505);
    const halves = [
      { motorway: 'A1', tollM: 1500 },
      { motorway: 'A1-1', tollM: 1500 },
    ];
    // A1-1 has no rate of its own: it counts as the A1. 3 km together: 27,83 → 28.
    expect(tollCents(halves, RATES)).toBe(28);
    const small = [
      { motorway: 'A1', tollM: 500 },
      { motorway: 'A1-1', tollM: 500 },
      { motorway: 'A1-2', tollM: 500 },
    ];
    // 1,5 km together: 13,92 → 14; apart, 4,64 → 5 three times = 15.
    expect(tollCents(small, RATES)).toBe(14);
  });

  it('a motorway that is free now costs nothing, also next to paid ones', () => {
    const rates: TollRate[] = [...RATES, { motorway: 'A23', referenceCents: 0, referenceM: 1000 }];
    expect(tollCents([{ motorway: 'A23', tollM: 50_000 }], rates)).toBe(0);
    expect(
      tollCents(
        [
          { motorway: 'A23', tollM: 17_000 },
          { motorway: 'A1', tollM: 270_000 },
        ],
        rates
      )
    ).toBe(2505);
  });

  it('a branch of a motorway without a rate goes to the default rate', () => {
    expect(tollCents([{ motorway: 'A8-1', tollM: 10_000 }], RATES)).toBe(80);
  });
});

describe('rateKeyOf', () => {
  it('prefers the motorway\'s own rate, then its main road, then the default', () => {
    const rates: TollRate[] = [...RATES, { motorway: 'A13-1', referenceCents: 100, referenceM: 10_000 }];
    expect(rateKeyOf('A1', rates)).toBe('A1');
    expect(rateKeyOf('A13-1', rates)).toBe('A13-1');
    expect(rateKeyOf('A1-1', rates)).toBe('A1');
    expect(rateKeyOf('A8', rates)).toBe('default');
    expect(rateKeyOf('default', rates)).toBe('default');
    expect(rateKeyOf('IC19', rates)).toBe('default');
  });
});

describe('tripCost', () => {
  const oneWay = {
    distanceM: 100_000,
    tollSegments: [{ motorway: 'A1', tollM: 27_000 }],
    consumptionClPer100Km: 650,
    fuelPriceMilliPerLitre: 1729,
    roundTrip: false,
  };

  it('adds fuel and tolls', () => {
    // Tolls: 27 km of the 270 km reference = 250,5 cents -> 251
    expect(tripCost(oneWay, RATES)).toEqual({ fuelCents: 1124, tollCents: 251, totalCents: 1375 });
  });

  it('counts both ways on a round trip', () => {
    expect(tripCost({ ...oneWay, roundTrip: true }, RATES)).toEqual({
      fuelCents: 2248,
      tollCents: 502,
      totalCents: 2750,
    });
  });
});

describe('sharePerPersonCents', () => {
  it('splits evenly when it can', () => {
    expect(sharePerPersonCents(3000, 3)).toBe(1000);
  });

  it('rounds each share up to the cent', () => {
    // 10,00 € for 3 people: 3,34 € each (the driver keeps 2 cents)
    expect(sharePerPersonCents(1000, 3)).toBe(334);
    expect(sharePerPersonCents(1, 2)).toBe(1);
  });

  it('the driver alone pays everything', () => {
    expect(sharePerPersonCents(2750, 1)).toBe(2750);
  });

  it('refuses nobody or fractions of people', () => {
    expect(() => sharePerPersonCents(1000, 0)).toThrow(RangeError);
    expect(() => sharePerPersonCents(1000, 1.5)).toThrow(RangeError);
    expect(() => sharePerPersonCents(-1, 2)).toThrow(RangeError);
  });
});

describe('priceLadder', () => {
  it('goes down as seats are taken', () => {
    expect(priceLadder(6000, 3)).toEqual([6000, 3000, 2000, 1500]);
  });

  it('never increases', () => {
    const ladder = priceLadder(2751, 7);
    for (let index = 1; index < ladder.length; index++) {
      expect(ladder[index]).toBeLessThanOrEqual(ladder[index - 1]);
    }
  });

  it('shares always cover the total', () => {
    const total = 2751;
    priceLadder(total, 7).forEach((share, taken) => {
      expect(share * (taken + 1)).toBeGreaterThanOrEqual(total);
    });
  });

  it('refuses a ride without seats', () => {
    expect(() => priceLadder(1000, 0)).toThrow(RangeError);
  });
});

describe('returnShareCents', () => {
  it('is a share of half the trip: the way home', () => {
    // 20,00 € there and back -> 10,00 € home, split by the driver and one passenger.
    expect(returnShareCents(2000, 2)).toBe(500);
  });

  it('gets cheaper as more people come back', () => {
    expect(returnShareCents(2000, 1)).toBe(1000);
    expect(returnShareCents(2000, 4)).toBe(250);
  });

  it('rounds up to the cent, like every other share', () => {
    // 10,01 € -> 5,01 € home, split by three: 1,67 € each.
    expect(returnShareCents(1001, 3)).toBe(167);
    expect(returnShareCents(1, 1)).toBe(1);
  });

  it('never costs more than going and coming back', () => {
    for (const total of [0, 1, 999, 2000, 54321]) {
      expect(returnShareCents(total, 2)).toBeLessThanOrEqual(sharePerPersonCents(total, 2));
    }
  });

  it('refuses nonsense', () => {
    expect(() => returnShareCents(-1, 2)).toThrow(RangeError);
    expect(() => returnShareCents(100, 0)).toThrow(RangeError);
  });
});
