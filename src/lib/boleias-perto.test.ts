import { describe, expect, it } from 'vitest';

import { kmDePartida, ordenarBoleiasPorPerto } from '@/lib/boleias-perto';

const COIMBRA = { latitude: 40.2249, longitude: -8.4484 };
const LEIRIA = { latitude: 39.7436, longitude: -8.8071 };
const PORTO = { latitude: 41.1496, longitude: -8.6109 };
const CONDEIXA = { latitude: 40.1133, longitude: -8.4972 };

function boleia(id: string, origin: typeof COIMBRA, extra: Partial<{ isMine: boolean; myStatus: string | null; driverIsFriend: boolean }> = {}) {
  return { id, origin, isMine: false, myStatus: null, driverIsFriend: false, ...extra };
}

describe('kmDePartida', () => {
  it('is null without a starting point', () => {
    expect(kmDePartida(null, PORTO)).toBeNull();
  });

  it('rounds to the km', () => {
    // Coimbra to Porto in a straight line is about 104 km.
    expect(kmDePartida(COIMBRA, PORTO)).toBeGreaterThanOrEqual(100);
    expect(kmDePartida(COIMBRA, PORTO)).toBeLessThanOrEqual(110);
    expect(Number.isInteger(kmDePartida(COIMBRA, CONDEIXA))).toBe(true);
  });
});

describe('ordenarBoleiasPorPerto', () => {
  it('keeps the server order when the starting point is unknown', () => {
    const lista = [boleia('porto', PORTO), boleia('condeixa', CONDEIXA)];
    expect(ordenarBoleiasPorPerto(lista, null).map((b) => b.id)).toEqual(['porto', 'condeixa']);
  });

  it('puts the closest first', () => {
    const lista = [boleia('porto', PORTO), boleia('leiria', LEIRIA), boleia('condeixa', CONDEIXA)];
    expect(ordenarBoleiasPorPerto(lista, COIMBRA).map((b) => b.id)).toEqual([
      'condeixa',
      'leiria',
      'porto',
    ]);
  });

  it('keeps mine and the ones I asked for on top, then friends', () => {
    const lista = [
      boleia('perto', CONDEIXA),
      boleia('amigo-longe', PORTO, { driverIsFriend: true }),
      boleia('pedi', LEIRIA, { myStatus: 'requested' }),
      boleia('minha', PORTO, { isMine: true }),
    ];
    expect(ordenarBoleiasPorPerto(lista, COIMBRA).map((b) => b.id)).toEqual([
      'pedi',
      'minha',
      'amigo-longe',
      'perto',
    ]);
  });

  it('keeps the server order between rides leaving from the same place', () => {
    const lista = [boleia('a', LEIRIA), boleia('b', LEIRIA)];
    expect(ordenarBoleiasPorPerto(lista, COIMBRA).map((b) => b.id)).toEqual(['a', 'b']);
  });

  it('does not change the list it was given', () => {
    const lista = [boleia('porto', PORTO), boleia('condeixa', CONDEIXA)];
    ordenarBoleiasPorPerto(lista, COIMBRA);
    expect(lista.map((b) => b.id)).toEqual(['porto', 'condeixa']);
  });
});
