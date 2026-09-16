import { describe, expect, it } from 'vitest';

import { datasDaEstadia, linkAirbnb, porPessoaNaCasa, precisaDeDormida } from '@/lib/dormida';

describe('datasDaEstadia', () => {
  it('enters the day before the game and leaves after the nights asked for', () => {
    expect(datasDaEstadia('2026-09-20T19:30:00Z', 2)).toEqual({
      checkin: '2026-09-19',
      checkout: '2026-09-21',
    });
  });

  it('one night is in and out', () => {
    expect(datasDaEstadia('2026-09-20T19:30:00Z', 1)).toEqual({
      checkin: '2026-09-19',
      checkout: '2026-09-20',
    });
  });

  it('a late kick-off still belongs to its own day in Lisbon', () => {
    expect(datasDaEstadia('2026-09-20T22:45:00Z', 1).checkin).toBe('2026-09-19');
  });
});

describe('linkAirbnb', () => {
  it('searches the city with the dates and the people filled in', () => {
    const link = linkAirbnb({
      cidade: 'Ponta Delgada',
      pais: 'Portugal',
      estadia: { checkin: '2026-09-19', checkout: '2026-09-21' },
      pessoas: 3,
    });
    expect(link).toBe(
      'https://www.airbnb.pt/s/Ponta-Delgada--Portugal/homes?checkin=2026-09-19&checkout=2026-09-21&adults=3'
    );
  });

  it('is always a search, never one listing', () => {
    const link = linkAirbnb({
      cidade: 'Funchal',
      pais: 'Portugal',
      estadia: { checkin: '2026-10-01', checkout: '2026-10-02' },
      pessoas: 1,
    });
    expect(link).toContain('/s/');
    expect(link).not.toContain('/rooms/');
  });
});

describe('dividir a casa', () => {
  it('divide o total por quem lá dorme, arredondando para cima ao cêntimo', () => {
    expect(porPessoaNaCasa(24000, 1)).toBe(24000);
    expect(porPessoaNaCasa(24000, 4)).toBe(6000);
    // 200,01 € por três: 66,67 € cada, e os cêntimos a mais ficam para o dono.
    expect(porPessoaNaCasa(20001, 3)).toBe(6667);
  });

  it('nunca divide por menos de uma pessoa', () => {
    expect(porPessoaNaCasa(10000, 0)).toBe(10000);
  });

  it('mostra o preço a descer à medida que a malta entra', () => {
    const casa = 24000;
    expect([1, 2, 3, 4].map((pessoas) => porPessoaNaCasa(casa, pessoas))).toEqual([
      24000, 12000, 8000, 6000,
    ]);
  });
});

describe('precisaDeDormida', () => {
  const funchal = {
    regiao: 'madeira' as const,
    coordenadas: { latitude: 32.65, longitude: -16.91 },
  };
  const lisboa = {
    regiao: 'continente' as const,
    coordenadas: { latitude: 38.75, longitude: -9.18 },
  };
  const porto = {
    regiao: 'continente' as const,
    coordenadas: { latitude: 41.16, longitude: -8.58 },
  };
  const viseu = {
    regiao: 'continente' as const,
    coordenadas: { latitude: 40.66, longitude: -7.91 },
  };
  const milao = {
    regiao: 'estrangeiro' as const,
    coordenadas: { latitude: 45.48, longitude: 9.12 },
  };

  it('um jogo nas ilhas ou no estrangeiro pede sempre dormida', () => {
    expect(precisaDeDormida(funchal, lisboa)).toBe(true);
    expect(precisaDeDormida(milao, viseu)).toBe(true);
  });

  it('quem é das ilhas precisa de dormida para vir ao continente, mesmo que o estádio pareça perto', () => {
    expect(precisaDeDormida(lisboa, funchal)).toBe(true);
    expect(precisaDeDormida(porto, funchal)).toBe(true);
  });

  it('no continente, só quando a estrada é longa', () => {
    expect(precisaDeDormida(lisboa, viseu)).toBe(false);
    expect(precisaDeDormida(porto, viseu)).toBe(false);
    expect(precisaDeDormida(lisboa, porto)).toBe(true);
  });

  it('sem terra conhecida, não se inventa uma viagem longa', () => {
    expect(precisaDeDormida(lisboa, null)).toBe(false);
    expect(precisaDeDormida(funchal, null)).toBe(true);
  });
});
