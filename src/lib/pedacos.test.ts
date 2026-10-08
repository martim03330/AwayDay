import { describe, expect, it } from 'vitest';

import { juntarPedacos, partirEmPedacos } from '@/lib/pedacos';

describe('partirEmPedacos / juntarPedacos', () => {
  it('splits a long session into pieces that join back exactly', () => {
    const sessao = JSON.stringify({ access_token: 'a'.repeat(1500), refresh_token: 'r'.repeat(40), user: { id: 'u' } });
    const pedacos = partirEmPedacos(sessao, 1800);
    expect(pedacos.length).toBe(Math.ceil(sessao.length / 1800));
    expect(pedacos.every((pedaco) => pedaco.length <= 1800)).toBe(true);
    expect(juntarPedacos(pedacos)).toBe(sessao);
  });

  it('keeps short and empty values whole', () => {
    expect(partirEmPedacos('abc', 1800)).toEqual(['abc']);
    expect(partirEmPedacos('', 1800)).toEqual(['']);
    expect(partirEmPedacos('abcdef', 2)).toEqual(['ab', 'cd', 'ef']);
  });

  it('gives nothing when a piece is missing', () => {
    expect(juntarPedacos(['ab', null, 'ef'])).toBeNull();
  });
});
