import { describe, expect, it } from 'vitest';

import { iniciais } from '@/lib/iniciais';

describe('iniciais', () => {
  it('uses the first and last word', () => {
    expect(iniciais('Martim Henriques')).toBe('MH');
    expect(iniciais('Rita das Bifanas')).toBe('RB');
    expect(iniciais('Martim')).toBe('M');
  });

  it('skips words that do not start with a letter', () => {
    expect(iniciais('Tiago (teste)')).toBe('T');
    expect(iniciais('Rui (teste)')).toBe('R');
    expect(iniciais('Ana - Porto')).toBe('AP');
    expect(iniciais('"Zé" 1990')).toBe('?');
  });

  it('keeps accented letters', () => {
    expect(iniciais('élio Ávila')).toBe('ÉÁ');
    expect(iniciais('Óscar (teste)')).toBe('Ó');
  });

  it('falls back to a question mark', () => {
    expect(iniciais('')).toBe('?');
    expect(iniciais('   ')).toBe('?');
    expect(iniciais('(teste)')).toBe('?');
  });
});
