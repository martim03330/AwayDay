import { describe, expect, it } from 'vitest';

import { clubesDoUtilizador } from './jogos';

describe('clubesDoUtilizador', () => {
  it('has no clubs when none was picked (never a default club)', () => {
    expect(clubesDoUtilizador(null, null)).toEqual([]);
  });

  it('keeps only the home-town club when no supported club was picked', () => {
    expect(clubesDoUtilizador(null, 'braga')).toEqual(['braga']);
  });

  it('lists both clubs once each', () => {
    expect(clubesDoUtilizador('porto', 'braga')).toEqual(['porto', 'braga']);
    expect(clubesDoUtilizador('porto', 'porto')).toEqual(['porto']);
  });
});
