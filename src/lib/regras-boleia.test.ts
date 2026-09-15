import { describe, expect, it } from 'vitest';

import {
  avisosDasBoleias,
  faseDaBoleia,
  podeCriarBoleia,
  podeReportarImprevisto,
  prazosDaBoleia,
} from '@/lib/regras-boleia';

const HORA = 60 * 60 * 1000;
const partida = new Date('2026-09-20T17:00:00Z');
const saida = partida.getTime();

describe('prazosDaBoleia', () => {
  it('closes requests 2 h before and counts the rest from departure', () => {
    const prazos = prazosDaBoleia(partida);
    expect(prazos.pedidosFecham.toISOString()).toBe('2026-09-20T15:00:00.000Z');
    expect(prazos.imprevistoAte.toISOString()).toBe('2026-09-21T17:00:00.000Z');
    expect(prazos.confirmarAte.toISOString()).toBe('2026-09-22T17:00:00.000Z');
    expect(prazos.votarAte.toISOString()).toBe('2026-09-23T17:00:00.000Z');
  });
});

describe('faseDaBoleia', () => {
  it('is open until 2 h before, inclusive of the millisecond before', () => {
    expect(faseDaBoleia(partida, saida - 2 * HORA - 1)).toBe('aberta');
    expect(faseDaBoleia(partida, saida - 2 * HORA)).toBe('fechada');
  });

  it('asks who turned up from departure for 48 h', () => {
    expect(faseDaBoleia(partida, saida)).toBe('a-confirmar');
    expect(faseDaBoleia(partida, saida + 48 * HORA - 1)).toBe('a-confirmar');
    expect(faseDaBoleia(partida, saida + 48 * HORA)).toBe('terminada');
  });
});

describe('podeCriarBoleia', () => {
  it('needs at least 3 h before departure', () => {
    expect(podeCriarBoleia(partida, saida - 3 * HORA)).toBe(true);
    expect(podeCriarBoleia(partida, saida - 3 * HORA + 1)).toBe(false);
  });
});

describe('podeReportarImprevisto', () => {
  it('from when requests close until 24 h after departure', () => {
    expect(podeReportarImprevisto(partida, saida - 2 * HORA - 1)).toBe(false);
    expect(podeReportarImprevisto(partida, saida - 2 * HORA)).toBe(true);
    expect(podeReportarImprevisto(partida, saida + 24 * HORA)).toBe(true);
    expect(podeReportarImprevisto(partida, saida + 24 * HORA + 1)).toBe(false);
  });
});

describe('avisosDasBoleias', () => {
  const boleia = {
    id: 'r1',
    jogoId: 'porto-benfica',
    partida,
    origem: 'Estação de Coimbra-B',
    papel: 'passageiro' as const,
  };

  it('schedules the day before, 3 h before and the confirmation after departure', () => {
    const avisos = avisosDasBoleias([boleia], saida - 48 * HORA);
    expect(avisos.map((aviso) => aviso.id)).toEqual(['r1:24h', 'r1:3h', 'r1:confirmar']);
    expect(avisos[1].quando.getTime()).toBe(saida - 3 * HORA);
    expect(avisos[1].corpo).toContain('reputação');
  });

  it('drops reminders already in the past', () => {
    const avisos = avisosDasBoleias([boleia], saida - 2 * HORA);
    expect(avisos.map((aviso) => aviso.id)).toEqual(['r1:confirmar']);
  });

  it('speaks to the driver as the one who takes people', () => {
    const [amanha] = avisosDasBoleias([{ ...boleia, papel: 'condutor' }], saida - 48 * HORA);
    expect(amanha.corpo).toContain('ninguém ficar em terra');
  });
});
