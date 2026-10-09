import { describe, expect, it } from 'vitest';

import {
  dayPhrase,
  lisbonDay,
  lisbonHour,
  timePhrase,
  whenPhrase,
} from '../../supabase/functions/_shared/portuguese';

const at = (iso: string) => new Date(iso);

describe('lisbonDay', () => {
  it('uses the Lisbon calendar day in winter and in summer', () => {
    expect(lisbonDay(at('2026-01-15T23:30:00Z'))).toBe('2026-01-15');
    expect(lisbonDay(at('2026-07-15T23:30:00Z'))).toBe('2026-07-16');
  });

  it('crosses month and year ends', () => {
    expect(lisbonDay(at('2026-08-31T23:00:00Z'))).toBe('2026-09-01');
    expect(lisbonDay(at('2026-12-31T23:59:00Z'))).toBe('2026-12-31');
    expect(lisbonDay(at('2027-01-01T00:00:00Z'))).toBe('2027-01-01');
  });
});

describe('lisbonHour', () => {
  it('is 0 to 23 in Lisbon', () => {
    expect(lisbonHour(at('2026-01-15T00:30:00Z'))).toBe(0);
    expect(lisbonHour(at('2026-07-15T23:30:00Z'))).toBe(0);
    expect(lisbonHour(at('2026-07-15T22:59:00Z'))).toBe(23);
    expect(lisbonHour(at('2026-01-15T23:59:00Z'))).toBe(23);
  });

  it('follows both clock changes', () => {
    expect(lisbonHour(at('2026-03-29T00:59:00Z'))).toBe(0);
    expect(lisbonHour(at('2026-03-29T01:00:00Z'))).toBe(2);
    expect(lisbonHour(at('2026-10-25T00:30:00Z'))).toBe(1);
    expect(lisbonHour(at('2026-10-25T01:30:00Z'))).toBe(1);
    expect(lisbonHour(at('2026-10-25T02:30:00Z'))).toBe(2);
  });
});

describe('whenPhrase', () => {
  it('says hoje and amanhã by the Lisbon day', () => {
    const now = at('2026-07-15T10:00:00Z');
    expect(whenPhrase(at('2026-07-15T19:30:00Z'), now)).toBe('hoje');
    // 23:30Z is already the 16th in Lisbon.
    expect(whenPhrase(at('2026-07-15T23:30:00Z'), now)).toBe('amanhã');
    expect(whenPhrase(at('2026-07-17T19:30:00Z'), now)).toBe('na sexta-feira');
    expect(whenPhrase(at('2026-07-18T19:30:00Z'), now)).toBe('no sábado');
  });

  it('crosses the end of a month and of a year', () => {
    expect(whenPhrase(at('2026-10-01T19:00:00Z'), at('2026-09-30T10:00:00Z'))).toBe('amanhã');
    expect(whenPhrase(at('2027-01-01T20:00:00Z'), at('2026-12-31T10:00:00Z'))).toBe('amanhã');
    expect(whenPhrase(at('2028-03-01T20:00:00Z'), at('2028-02-29T10:00:00Z'))).toBe('amanhã');
    expect(whenPhrase(at('2027-01-02T20:00:00Z'), at('2026-12-31T10:00:00Z'))).toBe('no sábado');
  });

  it('crosses both clock changes', () => {
    // 29 March has 23 hours and 25 October has 25: counted by calendar day, not by 24 hours.
    expect(whenPhrase(at('2026-03-30T19:00:00Z'), at('2026-03-29T22:30:00Z'))).toBe('amanhã');
    expect(whenPhrase(at('2026-03-29T22:30:00Z'), at('2026-03-29T00:30:00Z'))).toBe('hoje');
    expect(whenPhrase(at('2026-10-25T23:30:00Z'), at('2026-10-24T23:00:00Z'))).toBe('hoje');
    expect(whenPhrase(at('2026-10-26T12:00:00Z'), at('2026-10-24T23:00:00Z'))).toBe('amanhã');
  });
});

describe('dayPhrase', () => {
  it('names the weekday and the Lisbon day of the month', () => {
    expect(dayPhrase(at('2026-09-19T19:30:00Z'))).toBe('no sábado, dia 19');
    expect(dayPhrase(at('2026-07-15T23:30:00Z'))).toBe('na quinta-feira, dia 16');
    expect(dayPhrase(at('2026-12-31T23:30:00Z'))).toBe('na quinta-feira, dia 31');
    expect(dayPhrase(at('2026-08-31T23:30:00Z'))).toBe('na terça-feira, dia 1');
  });
});

describe('timePhrase', () => {
  it('is the Lisbon time', () => {
    expect(timePhrase(at('2026-07-15T19:30:00Z'))).toBe('20:30');
    expect(timePhrase(at('2026-01-15T19:30:00Z'))).toBe('19:30');
  });
});
