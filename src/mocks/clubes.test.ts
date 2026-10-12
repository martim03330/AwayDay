import { describe, expect, it } from 'vitest';

import { DIVISOES_NA_ESCOLHA, temJogosNaApp } from './clubes';

describe('clubes para escolher', () => {
  it('lets fans pick a club from every Portuguese division', () => {
    expect(DIVISOES_NA_ESCOLHA).toEqual([1, 2, 3]);
  });

  it('knows only Liga Portugal has fixtures for now', () => {
    expect(temJogosNaApp({ divisao: 1 })).toBe(true);
    expect(temJogosNaApp({ divisao: 2 })).toBe(false);
    expect(temJogosNaApp({ divisao: 3 })).toBe(false);
    expect(temJogosNaApp({ divisao: null })).toBe(false);
  });
});
