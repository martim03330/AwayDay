import { describe, expect, it } from 'vitest';

import {
  facilidadeEstacionamento,
  minutosAPe,
  minutosExtraDoParque,
} from '@/lib/facilidade-estacionamento';

const parque = (distanceM: number | null, capacity: number | null = null) => ({
  distanceM,
  capacity,
  openOnMatchdays: null,
});

describe('facilidadeEstacionamento', () => {
  it('next to the stadium fills first', () => {
    expect(facilidadeEstacionamento(parque(200)).nivel).toBe('dificil');
  });

  it('a big car park next to the stadium is only middling', () => {
    expect(facilidadeEstacionamento(parque(200, 600)).nivel).toBe('media');
  });

  it('a few minutes away is middling, and easy when it is big', () => {
    expect(facilidadeEstacionamento(parque(800)).nivel).toBe('media');
    expect(facilidadeEstacionamento(parque(800, 400)).nivel).toBe('facil');
  });

  it('far from the stadium is easy unless it is tiny', () => {
    expect(facilidadeEstacionamento(parque(2000)).nivel).toBe('facil');
    expect(facilidadeEstacionamento(parque(2000, 20)).nivel).toBe('media');
  });

  it('a big game makes the nearby ones worse, not the far ones', () => {
    expect(facilidadeEstacionamento(parque(800), { jogoGrande: true }).nivel).toBe('dificil');
    expect(facilidadeEstacionamento(parque(2000), { jogoGrande: true }).nivel).toBe('facil');
  });

  it('says so when it closes on match days or the distance is unknown', () => {
    expect(
      facilidadeEstacionamento({ distanceM: 100, capacity: null, openOnMatchdays: false }).nivel
    ).toBe('dificil');
    expect(facilidadeEstacionamento(parque(null)).nivel).toBe('desconhecida');
  });

  it('explains every estimate in one line', () => {
    for (const caso of [parque(200), parque(800, 400), parque(2000), parque(null)]) {
      expect(facilidadeEstacionamento(caso).motivo.length).toBeGreaterThan(10);
    }
  });
});

describe('minutosAPe', () => {
  it('walks 80 m a minute, with a detour for real streets', () => {
    expect(minutosAPe(800)).toBe(13);
    expect(minutosAPe(30)).toBe(1);
    expect(minutosAPe(null)).toBeNull();
  });
});

describe('minutosExtraDoParque', () => {
  it('asks for more time where parking is harder', () => {
    expect(minutosExtraDoParque(parque(2000))).toBe(0);
    expect(minutosExtraDoParque(parque(800))).toBe(20);
    expect(minutosExtraDoParque(parque(200))).toBe(45);
    expect(minutosExtraDoParque(parque(null))).toBe(15);
  });

  it('asks for more on a big game', () => {
    expect(minutosExtraDoParque(parque(800), { jogoGrande: true })).toBe(45);
  });
});
