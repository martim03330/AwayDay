import { describe, expect, it } from 'vitest';

import { LADO_MAXIMO_PX, medidaParaEnviar } from '@/lib/medida-da-foto';

describe('medidaParaEnviar', () => {
  it('brings the longest side of a big photo down to the maximum, keeping proportions', () => {
    expect(medidaParaEnviar(4032, 3024)).toEqual({ width: LADO_MAXIMO_PX });
    expect(medidaParaEnviar(3024, 4032)).toEqual({ height: LADO_MAXIMO_PX });
    expect(medidaParaEnviar(4000, 4000)).toEqual({ width: LADO_MAXIMO_PX });
  });

  it('never makes a small photo bigger', () => {
    expect(medidaParaEnviar(1600, 1200)).toBeNull();
    expect(medidaParaEnviar(800, 600)).toBeNull();
  });

  it('leaves an unreadable size alone', () => {
    expect(medidaParaEnviar(0, 1000)).toBeNull();
    expect(medidaParaEnviar(Number.NaN, 1000)).toBeNull();
  });
});
