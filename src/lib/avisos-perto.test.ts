import { describe, expect, it } from 'vitest';

import { avisosDeJogosPerto, distanciaKm, horaDoAviso } from '@/lib/avisos-perto';

const jogo = {
  id: 'jogo-1',
  inicio: '2026-09-20T17:00:00Z',
  nome: 'Académico de Viseu x Benfica',
  estadio: 'Estádio do Fontelo',
  distanciaKm: 12,
};

describe('horaDoAviso', () => {
  it('toca às 10:00 do próprio dia', () => {
    // Setembro em Lisboa: 10:00 locais são 09:00 UTC.
    expect(horaDoAviso(jogo.inicio).toISOString()).toBe('2026-09-20T09:00:00.000Z');
  });

  it('num jogo de manhã, avisa três horas antes', () => {
    expect(horaDoAviso('2026-09-20T10:30:00Z').toISOString()).toBe('2026-09-20T07:30:00.000Z');
  });
});

describe('avisosDeJogosPerto', () => {
  const agora = Date.parse('2026-09-18T12:00:00Z');

  it('avisa dos jogos perto que ainda estão para vir', () => {
    const avisos = avisosDeJogosPerto([jogo], agora);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].titulo).toBe('Hoje há jogo ao pé de ti');
    expect(avisos[0].corpo).toContain('a 12 km');
    expect(avisos[0].corpo).toContain('Estádio do Fontelo');
  });

  it('deixa de fora os jogos longe', () => {
    expect(avisosDeJogosPerto([{ ...jogo, distanciaKm: 120 }], agora)).toEqual([]);
  });

  it('não avisa de jogos cuja hora de aviso já passou', () => {
    expect(avisosDeJogosPerto([jogo], Date.parse('2026-09-20T12:00:00Z'))).toEqual([]);
  });

  it('põe os mais próximos primeiro', () => {
    const outro = { ...jogo, id: 'jogo-2', inicio: '2026-09-19T17:00:00Z' };
    expect(avisosDeJogosPerto([jogo, outro], agora).map((aviso) => aviso.id)).toEqual([
      'jogo-2',
      'jogo-1',
    ]);
  });
});

describe('distanciaKm', () => {
  it('mede em linha reta', () => {
    // Do Fontelo (Viseu) ao Dragão (Porto): 80 km em linha reta (de carro são mais, que a estrada dá voltas).
    const km = distanciaKm(
      { latitude: 40.6595, longitude: -7.9005 },
      { latitude: 41.1618, longitude: -8.5838 }
    );
    expect(Math.round(km)).toBe(80);
  });
});
