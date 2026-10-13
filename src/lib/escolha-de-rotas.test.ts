import { describe, expect, it } from 'vitest';

import {
  chooseRoutes,
  MAX_EXTRA_S,
  MIN_SAVING_CENTS,
  motorwaysOf,
  sameRoute,
  type Candidate,
} from '../../supabase/functions/_shared/route-choice';

/** A route of `km` km in `min` minutes with `tollKm` tolled, costing `cents` in total. */
function rota(km: number, min: number, tollKm: number, cents: number, motorway = 'A1'): Candidate {
  return {
    route: {
      distanceM: km * 1000,
      durationS: min * 60,
      tollM: tollKm * 1000,
      tollSegments: tollKm > 0 ? [{ motorway, tollM: tollKm * 1000 }] : [],
    },
    cost: { fuelCents: cents - Math.min(cents, tollKm * 7), tollCents: Math.min(cents, tollKm * 7), totalCents: cents },
  };
}

const opcoes = (candidatos: Candidate[]) =>
  chooseRoutes(candidatos).map((escolha) => `${escolha.option}:${escolha.candidate.cost.totalCents}`);

describe('chooseRoutes', () => {
  // Coimbra → Lisboa, as the router answers it: A1 all the way, A1 + A8, A13 for part of the way, and no tolls.
  const a1 = rota(204, 127, 190, 4200);
  const a8 = rota(215, 137, 198, 4500, 'A8');
  const a13 = rota(210, 145, 110, 3300, 'A13');
  const nacional = rota(207, 210, 0, 2700);

  it('offers the fastest, the cheapest with motorway, and the one without tolls', () => {
    expect(opcoes([a8, nacional, a1, a13])).toEqual(['rapida:4200', 'equilibrio:3300', 'sem_portagens:2700']);
  });

  it('never offers a route that is slower and dearer than the fastest (the A8 one)', () => {
    expect(opcoes([a1, a8])).toEqual(['rapida:4200']);
  });

  it('the same road given twice by the router shows once', () => {
    const quaseIgual = rota(205, 128, 190, 4210);
    expect(sameRoute(a1.route, quaseIgual.route)).toBe(true);
    expect(opcoes([a1, quaseIgual, nacional])).toEqual(['rapida:4200', 'sem_portagens:2700']);
  });

  it('«equilíbrio» must save real money', () => {
    const poucoMaisBarata = rota(210, 140, 120, 4200 - MIN_SAVING_CENTS + 1, 'A13');
    expect(opcoes([a1, poucoMaisBarata])).toEqual(['rapida:4200']);
    const justa = rota(210, 140, 120, 4200 - MIN_SAVING_CENTS, 'A13');
    expect(opcoes([a1, justa])).toEqual(['rapida:4200', `equilibrio:${4200 - MIN_SAVING_CENTS}`]);
  });

  it('«equilíbrio» may not take much longer than the fastest', () => {
    const lenta = rota(210, 127 + MAX_EXTRA_S / 60 + 1, 60, 3000, 'A13');
    expect(opcoes([a1, lenta])).toEqual(['rapida:4200']);
    const noLimite = rota(210, 127 + MAX_EXTRA_S / 60, 60, 3000, 'A13');
    expect(opcoes([a1, noLimite])).toEqual(['rapida:4200', 'equilibrio:3000']);
  });

  it('drops «equilíbrio» when the toll-free route is both cheaper and as fast', () => {
    const semVantagem = rota(210, 215, 40, 3300, 'A13');
    expect(opcoes([a1, semVantagem, nacional])).toEqual(['rapida:4200', 'sem_portagens:2700']);
  });

  it('picks the cheapest of several mixes, and the faster one on a tie', () => {
    const mistaA = rota(210, 150, 100, 3400, 'A13');
    const mistaB = rota(211, 140, 90, 3400, 'A23');
    const mistaC = rota(205, 160, 80, 3500, 'A13');
    const escolha = chooseRoutes([a1, mistaA, mistaB, mistaC]).find((c) => c.option === 'equilibrio');
    expect(escolha?.candidate).toBe(mistaB);
  });

  it('a toll-free fastest route is the only option', () => {
    const cidade = rota(8, 15, 0, 120);
    expect(opcoes([cidade, rota(9, 17, 0, 130)])).toEqual(['rapida:120']);
  });

  it('nothing to offer without routes', () => {
    expect(chooseRoutes([])).toEqual([]);
  });

  it('gives the same answer whatever the order the routes came in', () => {
    const ordens = [
      [a1, a8, a13, nacional],
      [nacional, a13, a8, a1],
      [a13, a1, nacional, a8],
    ];
    for (const ordem of ordens) {
      expect(opcoes(ordem)).toEqual(['rapida:4200', 'equilibrio:3300', 'sem_portagens:2700']);
    }
  });
});

describe('motorwaysOf', () => {
  it('lists the motorways in driving order, once each, without short bits or untagged tolls', () => {
    expect(
      motorwaysOf([
        { motorway: 'A13-1', tollM: 800 },
        { motorway: 'A13', tollM: 60_000 },
        { motorway: 'default', tollM: 3000 },
        { motorway: 'A1', tollM: 40_000 },
        { motorway: 'A13', tollM: 2000 },
      ])
    ).toEqual(['A13', 'A1']);
    expect(motorwaysOf([])).toEqual([]);
  });

  it('adds the pieces of a motorway before deciding it is too short', () => {
    expect(
      motorwaysOf([
        { motorway: 'A19', tollM: 600 },
        { motorway: 'A19', tollM: 600 },
      ])
    ).toEqual(['A19']);
  });
});
