import { describe, expect, it } from 'vitest';

import { tripCost, type TollRate } from '../../supabase/functions/_shared/ride-cost';
import {
  motorwayOf,
  routeFromCache,
  routeFromValhalla,
  routesFromValhalla,
  tollSegmentsOf,
} from '../../supabase/functions/_shared/route-parse';

describe('motorwayOf', () => {
  it('reads the motorway reference however Valhalla writes it', () => {
    expect(motorwayOf('A 1')).toBe('A1');
    expect(motorwayOf('A1')).toBe('A1');
    expect(motorwayOf(['A 1'])).toBe('A1');
    expect(motorwayOf(['Autoestrada do Norte', 'A 1'])).toBe('A1');
    expect(motorwayOf(['A 1/IP 1'])).toBe('A1');
    expect(motorwayOf(['IP 1;A 1'])).toBe('A1');
    expect(motorwayOf(['A 22'])).toBe('A22');
    expect(motorwayOf([' A 22 '])).toBe('A22');
    expect(motorwayOf(['A 41-1'])).toBe('A41-1');
  });

  it('uses "default" for anything that is not a motorway reference', () => {
    expect(motorwayOf(['Autoestrada do Norte'])).toBe('default');
    expect(motorwayOf(['IC 19'])).toBe('default');
    expect(motorwayOf(['Avenida 1'])).toBe('default');
    expect(motorwayOf(['A 1 Norte'])).toBe('default');
    expect(motorwayOf([])).toBe('default');
    expect(motorwayOf(undefined)).toBe('default');
    expect(motorwayOf(null)).toBe('default');
    expect(motorwayOf(1)).toBe('default');
    expect(motorwayOf([1, null, { name: 'A 1' }])).toBe('default');
    expect(motorwayOf([1, 'A 2'])).toBe('A2');
  });
});

const trip = (legs: unknown, summary: unknown = { length: 120.4, time: 4300.6 }) => ({
  trip: { summary, legs },
});

describe('tollSegmentsOf', () => {
  it('takes only toll maneuvers, in metres rounded to the nearest metre', () => {
    const segments = tollSegmentsOf(
      trip([
        {
          maneuvers: [
            { toll: true, length: 12.3456, street_names: ['A 1'] },
            { toll: false, length: 5, street_names: ['A 1'] },
            { length: 5, street_names: ['A 1'] },
            { toll: true, length: 0.0004, street_names: ['A 2'] },
            { toll: true, length: 0.0005, street_names: ['A 2'] },
          ],
        },
        { maneuvers: [{ toll: true, length: 1.5, street_names: ['Ponte 25 de Abril'] }] },
      ]).trip
    );
    expect(segments).toEqual([
      { motorway: 'A1', tollM: 12346 },
      { motorway: 'A2', tollM: 0 },
      { motorway: 'A2', tollM: 1 },
      { motorway: 'default', tollM: 1500 },
    ]);
  });

  it('skips toll maneuvers with a missing or impossible length', () => {
    expect(
      tollSegmentsOf(
        trip([
          {
            maneuvers: [
              { toll: true, street_names: ['A 1'] },
              { toll: true, length: '3', street_names: ['A 1'] },
              { toll: true, length: -1, street_names: ['A 1'] },
              { toll: true, length: Number.NaN, street_names: ['A 1'] },
              null,
            ],
          },
          'not a leg',
        ]).trip
      )
    ).toEqual([]);
    expect(tollSegmentsOf(undefined)).toEqual([]);
    expect(tollSegmentsOf({ legs: 'nope' })).toEqual([]);
  });
});

describe('routesFromValhalla', () => {
  const principal = trip([{ maneuvers: [{ toll: true, length: 100, street_names: ['A 1'] }] }]);
  const alternativa = trip([{ maneuvers: [{ toll: true, length: 60, street_names: ['A 13'] }] }], { length: 125, time: 5000 });

  it('gives the main trip first, then each alternative', () => {
    const routes = routesFromValhalla({ ...principal, alternates: [alternativa] });
    expect(routes.map((route) => route.tollSegments[0]?.motorway)).toEqual(['A1', 'A13']);
    expect(routes[1]).toMatchObject({ distanceM: 125000, durationS: 5000, tollM: 60000 });
  });

  it('skips an alternative it cannot read, and has nothing without a main trip', () => {
    expect(routesFromValhalla({ ...principal, alternates: [{ trip: {} }, null, 'x'] })).toHaveLength(1);
    expect(routesFromValhalla({ ...principal, alternates: 'x' })).toHaveLength(1);
    expect(routesFromValhalla({ alternates: [alternativa] })).toEqual([]);
    expect(routesFromValhalla(null)).toEqual([]);
  });
});

describe('routeFromValhalla', () => {
  it('turns the summary into metres and seconds, and adds up the tolled metres', () => {
    const route = routeFromValhalla(
      trip([{ maneuvers: [{ toll: true, length: 10.2, street_names: ['A 1'] }, { toll: true, length: 0.3, street_names: ['A 1'] }] }])
    );
    expect(route).toEqual({
      distanceM: 120400,
      durationS: 4301,
      tollM: 10500,
      tollSegments: [
        { motorway: 'A1', tollM: 10200 },
        { motorway: 'A1', tollM: 300 },
      ],
    });
  });

  it('gives null without a usable summary', () => {
    expect(routeFromValhalla(null)).toBeNull();
    expect(routeFromValhalla({})).toBeNull();
    expect(routeFromValhalla({ trip: {} })).toBeNull();
    expect(routeFromValhalla(trip([], { length: 10 }))).toBeNull();
    expect(routeFromValhalla(trip([], { length: '10', time: 60 }))).toBeNull();
    expect(routeFromValhalla(trip([], { length: Number.NaN, time: 60 }))).toBeNull();
    expect(routeFromValhalla(trip([], { length: -1, time: 60 }))).toBeNull();
  });

  it('never gives a route of zero metres or zero seconds', () => {
    expect(routeFromValhalla(trip([], { length: 0, time: 0 }))).toEqual({
      distanceM: 1,
      durationS: 1,
      tollM: 0,
      tollSegments: [],
    });
    expect(routeFromValhalla(trip(undefined, { length: 0.0001, time: 0.2 }))?.distanceM).toBe(1);
  });
});

describe('routeFromCache', () => {
  const good = {
    distance_m: 120400,
    duration_s: 4301,
    toll_segments: [
      { motorway: 'A1', tollM: 10200 },
      { motorway: 'default', tollM: 300 },
    ],
  };

  it('reads a good row', () => {
    expect(routeFromCache(good)).toEqual({
      distanceM: 120400,
      durationS: 4301,
      tollM: 10500,
      tollSegments: good.toll_segments,
    });
    expect(routeFromCache({ ...good, toll_segments: [] })?.tollM).toBe(0);
    expect(routeFromCache({ ...good, distance_m: '120400' })?.distanceM).toBe(120400);
  });

  it('refuses a malformed row, so the route is asked again', () => {
    expect(routeFromCache(null)).toBeNull();
    expect(routeFromCache({ ...good, toll_segments: [{ motorway: 'A1', tollM: '10200' }] })).toBeNull();
    expect(routeFromCache({ ...good, toll_segments: [{ motorway: 'A1', tollM: 10.5 }] })).toBeNull();
    expect(routeFromCache({ ...good, toll_segments: [{ motorway: 'A1', tollM: -1 }] })).toBeNull();
    expect(routeFromCache({ ...good, toll_segments: [{ motorway: 1, tollM: 10 }] })).toBeNull();
    expect(routeFromCache({ ...good, toll_segments: [{ motorway: '', tollM: 10 }] })).toBeNull();
    expect(routeFromCache({ ...good, toll_segments: [null] })).toBeNull();
    expect(routeFromCache({ ...good, toll_segments: null })).toBeNull();
    expect(routeFromCache({ ...good, toll_segments: { motorway: 'A1', tollM: 1 } })).toBeNull();
    expect(routeFromCache({ ...good, distance_m: 0 })).toBeNull();
    expect(routeFromCache({ ...good, distance_m: 'abc' })).toBeNull();
    expect(routeFromCache({ ...good, duration_s: null })).toBeNull();
    expect(routeFromCache({ ...good, duration_s: 1.5 })).toBeNull();
  });

  it('what it accepts never makes the cost throw on bad numbers', () => {
    const rates: TollRate[] = [
      { motorway: 'A1', referenceCents: 2505, referenceM: 270_000 },
      { motorway: 'default', referenceCents: 8, referenceM: 1000 },
    ];
    const route = routeFromCache(good);
    expect(route).not.toBeNull();
    if (!route) return;
    const cost = tripCost(
      {
        distanceM: route.distanceM,
        tollSegments: route.tollSegments,
        consumptionClPer100Km: 650,
        fuelPriceMilliPerLitre: 1729,
        roundTrip: false,
      },
      rates
    );
    expect(Number.isSafeInteger(cost.totalCents)).toBe(true);
  });
});

describe('tripCost on an unknown motorway', () => {
  it('throws when there is no default rate (the rides function answers cost_failed)', () => {
    expect(() =>
      tripCost(
        {
          distanceM: 1000,
          tollSegments: [{ motorway: 'A99', tollM: 1000 }],
          consumptionClPer100Km: 650,
          fuelPriceMilliPerLitre: 1729,
          roundTrip: false,
        },
        [{ motorway: 'A1', referenceCents: 2505, referenceM: 270_000 }]
      )
    ).toThrow(RangeError);
  });
});
