import { describe, expect, it } from 'vitest';

import {
  instanteAntesDoJogo,
  lerAcompanhantes,
  lerHora,
  nomeDoTransporte,
  problemaDaViagem,
  problemaDosAcompanhantes,
  type RascunhoDaViagem,
} from '@/features/casas/formulario';

describe('lerHora', () => {
  it('reads the usual ways of writing a time', () => {
    expect(lerHora('20:30')).toBe('20:30');
    expect(lerHora(' 9:05 ')).toBe('09:05');
    expect(lerHora('20h30')).toBe('20:30');
    expect(lerHora('7h')).toBe('07:00');
    expect(lerHora('00:00')).toBe('00:00');
  });

  it('refuses what is not a time of day', () => {
    expect(lerHora('24:00')).toBeNull();
    expect(lerHora('12:60')).toBeNull();
    expect(lerHora('')).toBeNull();
    expect(lerHora('amanhã')).toBeNull();
  });
});

describe('instanteAntesDoJogo', () => {
  it('turns a Lisbon time some days before the game into UTC (winter)', () => {
    expect(instanteAntesDoJogo('2026-11-08T15:00:00Z', 1, '20:00')).toBe('2026-11-07T20:00:00.000Z');
  });

  it('turns a Lisbon time on the game day into UTC (summer)', () => {
    expect(instanteAntesDoJogo('2026-08-15T19:00:00Z', 0, '18:30')).toBe('2026-08-15T17:30:00.000Z');
  });

  it('uses the game day in Lisbon, not in UTC', () => {
    // 00:30 in Lisbon on 16 August is still 15 August in UTC.
    expect(instanteAntesDoJogo('2026-08-15T23:30:00Z', 0, '10:00')).toBe('2026-08-16T09:00:00.000Z');
  });
});

describe('lerAcompanhantes', () => {
  it('splits names by commas and drops the empty ones', () => {
    expect(lerAcompanhantes('Ana, Rui , ,  ')).toEqual(['Ana', 'Rui']);
    expect(lerAcompanhantes('')).toEqual([]);
  });
});

describe('nomeDoTransporte', () => {
  it('names a vehicle by its kind and number', () => {
    expect(nomeDoTransporte('autocarro', 2)).toBe('Autocarro 2');
    expect(nomeDoTransporte('minibus', 1)).toBe('Minibus 1');
    expect(nomeDoTransporte('carrinha', 3)).toBe('Carrinha 3');
  });
});

describe('problemaDaViagem', () => {
  const agora = Date.parse('2026-11-01T10:00:00Z');
  const base: RascunhoDaViagem = {
    nome: 'Autocarro da sede',
    precoCentimos: 1500,
    prazo: '2026-11-07T20:00:00.000Z',
    paragens: [{ passesAt: '2026-11-08T09:00:00.000Z' }],
    transportes: [{ label: 'Autocarro 1', seats: 50 }],
    kickoffAt: '2026-11-08T15:00:00Z',
  };

  it('accepts a complete trip, free ones too', () => {
    expect(problemaDaViagem(base, agora)).toBeNull();
    expect(problemaDaViagem({ ...base, precoCentimos: 0 }, agora)).toBeNull();
  });

  it('says what is missing or wrong', () => {
    expect(problemaDaViagem({ ...base, nome: ' ab ' }, agora)).toBe(
      'O nome da viagem precisa de pelo menos 3 letras.'
    );
    expect(problemaDaViagem({ ...base, precoCentimos: null }, agora)).toBe(
      'Escreve o preço por pessoa (0 se for gratuita), até 1000 €.'
    );
    expect(problemaDaViagem({ ...base, precoCentimos: 100_001 }, agora)).toBe(
      'Escreve o preço por pessoa (0 se for gratuita), até 1000 €.'
    );
    expect(problemaDaViagem({ ...base, prazo: null }, agora)).toBe(
      'Escreve a hora do prazo das inscrições (ex.: 20:00).'
    );
    expect(problemaDaViagem({ ...base, prazo: '2026-11-08T15:30:00.000Z' }, agora)).toBe(
      'O prazo das inscrições tem de ser depois de agora e antes do jogo.'
    );
    expect(problemaDaViagem({ ...base, paragens: [] }, agora)).toBe('Acrescenta pelo menos uma paragem.');
    expect(
      problemaDaViagem({ ...base, paragens: [{ passesAt: '2026-11-08T16:00:00.000Z' }] }, agora)
    ).toBe('Cada paragem tem de ser depois de agora e antes do jogo.');
    expect(problemaDaViagem({ ...base, transportes: [] }, agora)).toBe(
      'Acrescenta pelo menos um transporte.'
    );
    expect(problemaDaViagem({ ...base, transportes: [{ label: ' ', seats: 50 }] }, agora)).toBe(
      'Dá um nome a cada transporte.'
    );
  });
});

describe('problemaDosAcompanhantes', () => {
  it('takes up to 10 names of 2 to 60 letters', () => {
    expect(problemaDosAcompanhantes([])).toBeNull();
    expect(problemaDosAcompanhantes(['Ana', 'Rui'])).toBeNull();
    expect(problemaDosAcompanhantes(Array.from({ length: 10 }, (_, i) => `Pessoa ${i}`))).toBeNull();
  });

  it('refuses more than 10, or a name too short or too long', () => {
    expect(problemaDosAcompanhantes(Array.from({ length: 11 }, (_, i) => `Pessoa ${i}`))).toBe(
      'No máximo 10 pessoas a acompanhar.'
    );
    expect(problemaDosAcompanhantes(['A'])).toBe('Cada nome tem de ter de 2 a 60 letras.');
    expect(problemaDosAcompanhantes(['x'.repeat(61)])).toBe('Cada nome tem de ter de 2 a 60 letras.');
  });
});
