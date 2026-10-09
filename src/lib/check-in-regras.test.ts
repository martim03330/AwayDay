import { describe, expect, it } from 'vitest';

import {
  checkPresence,
  distanceM,
  MAX_DISTANCE_M,
  parseCheckInBody,
} from '../../supabase/functions/_shared/check-in-rules';

const PLACE = { latitude: 38.7527, longitude: -9.1848 };
/** Metres in one degree of latitude on the haversine sphere. */
const M_PER_DEGREE = (6_371_000 * Math.PI) / 180;
const north = (metres: number) => PLACE.latitude + metres / M_PER_DEGREE;

describe('parseCheckInBody', () => {
  const checkIn = { action: 'check-in', placeId: 'tasco-do-ze-1', latitude: 38.75, longitude: -9.18, accuracy: 20 };

  it('reads a check-in and keeps only what it needs', () => {
    expect(parseCheckInBody({ ...checkIn, extra: 'x' })).toEqual(checkIn);
  });

  it('reads a check-out without coordinates', () => {
    expect(parseCheckInBody({ action: 'check-out', placeId: 'tasco-do-ze-1' })).toEqual({
      action: 'check-out',
      placeId: 'tasco-do-ze-1',
    });
    // Coordinates sent with a check-out are dropped, not kept.
    expect(parseCheckInBody({ action: 'check-out', placeId: 'tasco', latitude: 38, longitude: -9 })).toEqual({
      action: 'check-out',
      placeId: 'tasco',
    });
  });

  it('refuses a bad place id', () => {
    for (const placeId of ['', 'Tasco', 'tasco do zé', 'tasco_1', 'a'.repeat(121), 42, null, undefined, "x'; drop"]) {
      expect(parseCheckInBody({ ...checkIn, placeId })).toBeNull();
    }
    expect(parseCheckInBody({ ...checkIn, placeId: 'a'.repeat(120) })).not.toBeNull();
  });

  it('refuses coordinates out of range or not finite', () => {
    for (const latitude of [90.0001, -90.0001, Number.NaN, Number.POSITIVE_INFINITY, '38.75', null]) {
      expect(parseCheckInBody({ ...checkIn, latitude })).toBeNull();
    }
    for (const longitude of [180.0001, -180.0001, Number.NaN, Number.NEGATIVE_INFINITY, '-9', undefined]) {
      expect(parseCheckInBody({ ...checkIn, longitude })).toBeNull();
    }
    for (const accuracy of [-1, 100_001, Number.NaN, Number.POSITIVE_INFINITY, '20']) {
      expect(parseCheckInBody({ ...checkIn, accuracy })).toBeNull();
    }
    expect(parseCheckInBody({ ...checkIn, latitude: 90, longitude: -180, accuracy: 0 })).not.toBeNull();
  });

  it('refuses anything that is not a check-in or check-out', () => {
    expect(parseCheckInBody(null)).toBeNull();
    expect(parseCheckInBody([checkIn])).toBeNull();
    expect(parseCheckInBody('check-in')).toBeNull();
    expect(parseCheckInBody({ ...checkIn, action: 'teleport' })).toBeNull();
    expect(parseCheckInBody({ ...checkIn, action: undefined })).toBeNull();
  });
});

describe('checkPresence', () => {
  it('accepts an accuracy of 100 m and refuses 100.1 m', () => {
    expect(checkPresence({ ...PLACE, accuracy: 100 }, PLACE)).toEqual({ ok: true });
    expect(checkPresence({ ...PLACE, accuracy: 100.1 }, PLACE)).toEqual({ ok: false, error: 'low_accuracy' });
  });

  it('accepts 150 m and refuses 151 m, with the distance rounded to 50 m', () => {
    const at150 = { latitude: north(MAX_DISTANCE_M - 1e-6), longitude: PLACE.longitude, accuracy: 10 };
    expect(distanceM({ lat: at150.latitude, lng: at150.longitude }, { lat: PLACE.latitude, lng: PLACE.longitude })).toBeCloseTo(150, 3);
    expect(checkPresence(at150, PLACE)).toEqual({ ok: true });

    const at151 = { latitude: north(151), longitude: PLACE.longitude, accuracy: 10 };
    expect(checkPresence(at151, PLACE)).toEqual({ ok: false, error: 'too_far', distance_m: 150 });

    const at430 = { latitude: north(430), longitude: PLACE.longitude, accuracy: 10 };
    expect(checkPresence(at430, PLACE)).toEqual({ ok: false, error: 'too_far', distance_m: 450 });
    const at420 = { latitude: north(420), longitude: PLACE.longitude, accuracy: 10 };
    expect(checkPresence(at420, PLACE)).toEqual({ ok: false, error: 'too_far', distance_m: 400 });
  });

  it('checks the accuracy before the distance', () => {
    expect(checkPresence({ latitude: north(5000), longitude: PLACE.longitude, accuracy: 500 }, PLACE)).toEqual({
      ok: false,
      error: 'low_accuracy',
    });
  });

  it('never answers with coordinates', () => {
    const answers = [
      checkPresence({ ...PLACE, accuracy: 5 }, PLACE),
      checkPresence({ ...PLACE, accuracy: 500 }, PLACE),
      checkPresence({ latitude: north(1234), longitude: PLACE.longitude, accuracy: 5 }, PLACE),
    ];
    for (const answer of answers) {
      const text = JSON.stringify(answer);
      expect(Object.keys(answer).sort()).not.toContain('latitude');
      expect(text).not.toMatch(/lat|lon|lng|38\.7|-9\.1/);
      for (const key of Object.keys(answer)) expect(['ok', 'error', 'distance_m']).toContain(key);
    }
  });
});

describe('distanceM', () => {
  it('is zero at the same point and symmetric', () => {
    const a = { lat: 38.7527, lng: -9.1848 };
    const b = { lat: 41.1617, lng: -8.5839 };
    expect(distanceM(a, a)).toBe(0);
    expect(distanceM(a, b)).toBeCloseTo(distanceM(b, a), 6);
    // Luz to Dragão, in a straight line: about 273 km.
    expect(Math.round(distanceM(a, b) / 1000)).toBe(273);
  });
});
