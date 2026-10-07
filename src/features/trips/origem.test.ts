import { describe, expect, it } from 'vitest';

import { casaLancadaAMao, notaDaOrigem } from '@/features/trips/origem';

describe('notaDaOrigem', () => {
  it('marks the expenses that enter on their own', () => {
    expect(notaDaOrigem('boleia')).toBe('segue o carro');
    expect(notaDaOrigem('casa')).toBe('segue a casa');
  });

  it('says nothing about expenses typed by hand', () => {
    expect(notaDaOrigem('manual')).toBeNull();
  });
});

describe('casaLancadaAMao', () => {
  it('flags the house typed by hand next to the one that entered on its own', () => {
    expect(
      casaLancadaAMao([
        { source: 'casa', category: 'casa' },
        { source: 'manual', category: 'casa' },
      ])
    ).toBe(true);
  });

  it('is quiet when the house is only there once', () => {
    expect(casaLancadaAMao([{ source: 'casa', category: 'casa' }])).toBe(false);
    expect(casaLancadaAMao([{ source: 'manual', category: 'casa' }])).toBe(false);
  });

  it('ignores other expenses typed by hand', () => {
    expect(
      casaLancadaAMao([
        { source: 'casa', category: 'casa' },
        { source: 'manual', category: 'cerveja' },
        { source: 'boleia', category: 'boleia' },
      ])
    ).toBe(false);
  });

  it('is quiet with no expenses', () => {
    expect(casaLancadaAMao([])).toBe(false);
  });
});
