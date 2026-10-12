import { describe, expect, it } from 'vitest';

import {
  aindaDaParaEditar,
  comAMinhaReacao,
  eLocal,
  idLocal,
  lerCitacao,
  lerReacoes,
  minhaReacao,
  proximaReacao,
} from './conversa';

describe('lerReacoes', () => {
  it('reads what the server sends', () => {
    expect(lerReacoes([{ emoji: '👍', count: 2, mine: true }])).toEqual([{ emoji: '👍', count: 2, mine: true }]);
  });

  it('skips anything it does not know', () => {
    expect(lerReacoes(null)).toEqual([]);
    expect(lerReacoes([{ emoji: '💩', count: 1 }, { emoji: '👍', count: 0 }, 'x'])).toEqual([]);
  });
});

describe('reactions', () => {
  const reacoes = lerReacoes([
    { emoji: '👍', count: 2, mine: false },
    { emoji: '⚽', count: 1, mine: true },
  ]);

  it('knows mine', () => {
    expect(minhaReacao(reacoes)).toBe('⚽');
    expect(minhaReacao([])).toBeNull();
  });

  it('the same emoji again takes it away, another one replaces it', () => {
    expect(proximaReacao(reacoes, '⚽')).toBeNull();
    expect(proximaReacao(reacoes, '👍')).toBe('👍');
  });
});

describe('lerCitacao', () => {
  it('is null when the message is not a reply', () => {
    expect(lerCitacao(null, 'Zé', 'olá')).toBeNull();
  });

  it('keeps a quote without text (deleted, hidden or blocked)', () => {
    expect(lerCitacao('id', 'Zé', null)).toEqual({ id: 'id', displayName: 'Zé', body: null });
  });
});

describe('aindaDaParaEditar', () => {
  const criada = '2026-10-12T12:00:00.000Z';
  const t = Date.parse(criada);

  it('allows 15 minutes', () => {
    expect(aindaDaParaEditar(criada, t + 14 * 60_000)).toBe(true);
    expect(aindaDaParaEditar(criada, t + 15 * 60_000)).toBe(false);
  });

  it('refuses a date it cannot read', () => {
    expect(aindaDaParaEditar('', t)).toBe(false);
  });
});

describe('comAMinhaReacao', () => {
  const de = (valor: unknown) => lerReacoes(valor);

  it('adds mine', () => {
    expect(comAMinhaReacao([], '👍')).toEqual([{ emoji: '👍', count: 1, mine: true }]);
    expect(comAMinhaReacao(de([{ emoji: '👍', count: 2, mine: false }]), '👍')).toEqual([
      { emoji: '👍', count: 3, mine: true },
    ]);
  });

  it('moves mine to another emoji (one per person)', () => {
    expect(
      comAMinhaReacao(
        de([
          { emoji: '👍', count: 2, mine: true },
          { emoji: '⚽', count: 1, mine: false },
        ]),
        '⚽'
      )
    ).toEqual([
      { emoji: '⚽', count: 2, mine: true },
      { emoji: '👍', count: 1, mine: false },
    ]);
  });

  it('takes mine away, and the emoji with it when it was only mine', () => {
    expect(comAMinhaReacao(de([{ emoji: '😂', count: 1, mine: true }]), null)).toEqual([]);
    expect(comAMinhaReacao(de([{ emoji: '😂', count: 3, mine: true }]), null)).toEqual([
      { emoji: '😂', count: 2, mine: false },
    ]);
  });
});

describe('local messages', () => {
  it('are told apart from the server ones', () => {
    expect(eLocal(idLocal(1))).toBe(true);
    expect(eLocal('0b6c6c8e-0000-4000-8000-000000000000')).toBe(false);
    expect(idLocal(1)).not.toBe(idLocal(1));
  });
});
