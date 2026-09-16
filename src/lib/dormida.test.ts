import { describe, expect, it } from 'vitest';

import {
  datasDaEstadia,
  linkAirbnb,
  medianaCentimos,
  porPessoaPorNoite,
  totalDaEstadia,
} from '@/lib/dormida';

describe('datasDaEstadia', () => {
  it('enters the day before the game and leaves after the nights asked for', () => {
    expect(datasDaEstadia('2026-09-20T19:30:00Z', 2)).toEqual({
      checkin: '2026-09-19',
      checkout: '2026-09-21',
    });
  });

  it('one night is in and out', () => {
    expect(datasDaEstadia('2026-09-20T19:30:00Z', 1)).toEqual({
      checkin: '2026-09-19',
      checkout: '2026-09-20',
    });
  });

  it('a late kick-off still belongs to its own day in Lisbon', () => {
    expect(datasDaEstadia('2026-09-20T22:45:00Z', 1).checkin).toBe('2026-09-19');
  });
});

describe('linkAirbnb', () => {
  it('searches the city with the dates and the people filled in', () => {
    const link = linkAirbnb({
      cidade: 'Ponta Delgada',
      pais: 'Portugal',
      estadia: { checkin: '2026-09-19', checkout: '2026-09-21' },
      pessoas: 3,
    });
    expect(link).toBe(
      'https://www.airbnb.pt/s/Ponta-Delgada--Portugal/homes?checkin=2026-09-19&checkout=2026-09-21&adults=3'
    );
  });

  it('is always a search, never one listing', () => {
    const link = linkAirbnb({
      cidade: 'Funchal',
      pais: 'Portugal',
      estadia: { checkin: '2026-10-01', checkout: '2026-10-02' },
      pessoas: 1,
    });
    expect(link).toContain('/s/');
    expect(link).not.toContain('/rooms/');
  });
});

describe('money', () => {
  it('splits a night between people, rounded up to the cent', () => {
    expect(porPessoaPorNoite(12000, 4)).toBe(3000);
    expect(porPessoaPorNoite(10000, 3)).toBe(3334);
    expect(porPessoaPorNoite(5000, 0)).toBe(5000);
  });

  it('adds up the nights', () => {
    expect(totalDaEstadia(12000, 2)).toBe(24000);
    expect(totalDaEstadia(12000, 0)).toBe(12000);
  });
});

describe('medianaCentimos', () => {
  it('needs at least three reports to say anything', () => {
    expect(medianaCentimos([])).toBeNull();
    expect(medianaCentimos([4000, 6000])).toBeNull();
  });

  it('is the middle one, in whole cents', () => {
    expect(medianaCentimos([4000, 6000, 5000])).toBe(5000);
    // Com um número par de relatos é a média dos dois do meio, arredondada ao cêntimo: (5001 + 6000) / 2.
    expect(medianaCentimos([4000, 5001, 6000, 7000])).toBe(5501);
  });
});
