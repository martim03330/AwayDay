import { describe, expect, it } from 'vitest';

import { aindaDaParaEditar, lerCitacao, lerReacoes, minhaReacao, proximaReacao } from './conversa';

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
