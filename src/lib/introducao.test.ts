import { describe, expect, it } from 'vitest';

import { passoSeguinte, posicaoNaIntroducao } from '@/lib/introducao';

describe('passoSeguinte', () => {
  it('with an account goes photo, club, area, transport, notices', () => {
    expect(passoSeguinte('foto', true)).toBe('clube');
    expect(passoSeguinte('clube', true)).toBe('zona');
    expect(passoSeguinte('zona', true)).toBe('transporte');
    expect(passoSeguinte('transporte', true)).toBe('avisos');
    expect(passoSeguinte('avisos', true)).toBeNull();
  });

  it('without an account goes straight from the club to the notices', () => {
    expect(passoSeguinte('clube', false)).toBe('avisos');
    expect(passoSeguinte('avisos', false)).toBeNull();
  });

  it('a step that does not apply without an account starts the list again', () => {
    expect(passoSeguinte('zona', false)).toBe('clube');
  });
});

describe('posicaoNaIntroducao', () => {
  it('counts the steps of each path', () => {
    expect(posicaoNaIntroducao('foto', true)).toEqual({ passo: 1, total: 5 });
    expect(posicaoNaIntroducao('avisos', true)).toEqual({ passo: 5, total: 5 });
    expect(posicaoNaIntroducao('clube', false)).toEqual({ passo: 1, total: 2 });
    expect(posicaoNaIntroducao('avisos', false)).toEqual({ passo: 2, total: 2 });
  });

  it('a step outside the path shows as the first', () => {
    expect(posicaoNaIntroducao('foto', false)).toEqual({ passo: 1, total: 2 });
  });
});
