import { describe, expect, it } from 'vitest';

import { clubesDoUtilizador, faseCurta } from './jogos';

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

describe('faseCurta', () => {
  it('turns any matchday into «N.ª jornada»', () => {
    expect(faseCurta('Fase de liga · Jornada 3')).toBe('3.ª jornada');
    expect(faseCurta('Jornada 27')).toBe('27.ª jornada');
  });

  it('keeps the last part of other stages', () => {
    expect(faseCurta('Fase a eliminar · Oitavos de final')).toBe('Oitavos de final');
    expect(faseCurta('Final')).toBe('Final');
  });
});
