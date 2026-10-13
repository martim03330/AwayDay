import { describe, expect, it } from 'vitest';

import {
  chooseRoutes,
  MAX_EXTRA_S,
  MIN_SAVING_CENTS,
  MINUTE_CENTS,
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
      motorways: tollKm > 0 ? [motorway] : [],
      viaPoints: [],
    },
    cost: { fuelCents: cents - Math.min(cents, tollKm * 7), tollCents: Math.min(cents, tollKm * 7), totalCents: cents },
  };
}

const opcoes = (candidatos: Candidate[], ways: 1 | 2 = 1) =>
  chooseRoutes(candidatos, ways).map((escolha) => `${escolha.option}:${escolha.candidate.cost.totalCents}`);

describe('chooseRoutes', () => {
  // Coimbra → Lisboa, as the router answers it: A1 all the way, A1 + A8, A13 for part of the way, and no tolls.
  const a1 = rota(204, 127, 190, 4200);
  const a8 = rota(215, 137, 198, 4500, 'A8');
  const a13 = rota(210, 131, 110, 3300, 'A13');
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
    const poucoMaisBarata = rota(210, 128, 120, 4200 - MIN_SAVING_CENTS + 1, 'A13');
    expect(opcoes([a1, poucoMaisBarata])).toEqual(['rapida:4200']);
    const justa = rota(210, 128, 120, 4200 - MIN_SAVING_CENTS, 'A13');
    expect(opcoes([a1, justa])).toEqual(['rapida:4200', `equilibrio:${4200 - MIN_SAVING_CENTS}`]);
  });

  it('«equilíbrio» may not take much longer than the fastest', () => {
    const lenta = rota(210, 127 + MAX_EXTRA_S / 60 + 1, 60, 1000, 'A13');
    expect(opcoes([a1, lenta])).toEqual(['rapida:4200']);
    const noLimite = rota(210, 127 + MAX_EXTRA_S / 60, 60, 1000, 'A13');
    expect(opcoes([a1, noLimite])).toEqual(['rapida:4200', 'equilibrio:1000']);
  });

  it('«equilíbrio» must save more than the extra minutes are worth', () => {
    // 10 min more: worth 400 cents one way, 800 both ways.
    const custo = 4200 - 10 * MINUTE_CENTS;
    expect(opcoes([a1, rota(210, 137, 60, custo - 1, 'A13')])).toEqual(['rapida:4200', `equilibrio:${custo - 1}`]);
    expect(opcoes([a1, rota(210, 137, 60, custo, 'A13')])).toEqual(['rapida:4200']);
    // Coming back too, the same 10 min count twice.
    expect(opcoes([a1, rota(210, 137, 60, custo - 1, 'A13')], 2)).toEqual(['rapida:4200']);
  });

  it('drops «equilíbrio» when the toll-free route is both cheaper and as fast', () => {
    const semVantagem = rota(210, 215, 40, 3300, 'A13');
    expect(opcoes([a1, semVantagem, nacional])).toEqual(['rapida:4200', 'sem_portagens:2700']);
  });

  it('Coimbra → Luz, round trip: the A13 a few minutes slower beats the A19 half an hour slower', () => {
    // Real routes and prices (Valhalla, 2026 tolls, 6,5 L/100 km at 1,75 €/L), both ways.
    const rapida = rota(204, 127, 189, 8052, 'A1');
    const porA13 = rota(210, 131, 119, 6598, 'A13');
    const porA19 = rota(199, 157, 70, 5730, 'A19');
    const nacional = rota(207, 210, 0, 4706);
    const escolha = chooseRoutes([rapida, porA19, porA13, nacional], 2).find((c) => c.option === 'equilibrio');
    expect(escolha?.candidate).toBe(porA13);
    expect(opcoes([rapida, porA19, porA13, nacional], 2)).toEqual(['rapida:8052', 'equilibrio:6598', 'sem_portagens:4706']);
  });

  it('of two mixes worth the same, the cheaper one', () => {
    const mistaA = rota(210, 137, 100, 3400, 'A13');
    const mistaB = rota(211, 137, 90, 3300, 'A23');
    const escolha = chooseRoutes([a1, mistaA, mistaB]).find((c) => c.option === 'equilibrio');
    expect(escolha?.candidate).toBe(mistaB);
  });

  it('no «sem portagens» when the fastest is already free (the A25 from Guarda)', () => {
    const a25 = rota(170, 123, 160, 1952, 'A25');
    a25.cost = { fuelCents: 1952, tollCents: 0, totalCents: 1952 };
    expect(opcoes([a25, rota(160, 127, 0, 1810)])).toEqual(['rapida:1952']);
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
