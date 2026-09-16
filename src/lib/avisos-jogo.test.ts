import { describe, expect, it } from 'vitest';

import { avisosDoJogo, horasDoPlano } from './avisos-jogo';
import { chaveDoDia, formatarHora } from './datas';

const MINUTO_MS = 60 * 1000;
const DIA_MS = 24 * 60 * MINUTO_MS;

/** Porto x Benfica, Saturday 19 September 2026 at 19:30 in Lisbon (18:30 UTC, summer time). */
const jogo = { id: 'porto-benfica', inicio: '2026-09-19T18:30:00.000Z', horaConfirmada: true };
const equipas = { casa: 'FC Porto', fora: 'Benfica' };
const tasco = { nome: 'Tasca do Zé', minutosAPe: 12 };
const muitoAntes = Date.parse('2026-09-01T10:00:00.000Z');

describe('horasDoPlano', () => {
  it('com tasco: chegar 2 h 30 antes e sair a tempo de andar e entrar, com 10 min de folga', () => {
    const horas = horasDoPlano(jogo, tasco);
    const inicio = Date.parse(jogo.inicio);
    expect(horas.chegarAoTasco?.getTime()).toBe(inicio - 150 * MINUTO_MS);
    // 12 min a pé + 15 min para entrar + 10 min de folga.
    expect(horas.sairParaOEstadio.getTime()).toBe(inicio - 37 * MINUTO_MS);
  });

  it('sem tasco: ir para o estádio 90 min antes', () => {
    const horas = horasDoPlano(jogo, null);
    expect(horas.chegarAoTasco).toBeNull();
    expect(horas.sairParaOEstadio.getTime()).toBe(Date.parse(jogo.inicio) - 90 * MINUTO_MS);
  });
});

describe('avisosDoJogo', () => {
  it('agenda o lembrete 3 dias antes às 19:00 de Lisboa, a ida para o tasco e a saída para o estádio', () => {
    const avisos = avisosDoJogo(jogo, equipas, tasco, muitoAntes);
    expect(avisos.map((aviso) => aviso.id)).toEqual([
      'porto-benfica:plano',
      'porto-benfica:tasco',
      'porto-benfica:estadio',
      'porto-benfica:carimbo',
    ]);
    const plano = avisos[0].quando;
    expect(chaveDoDia(plano)).toBe('2026-09-16');
    expect(formatarHora(plano)).toBe('19:00');
    expect(avisos[1].titulo).toBe('Hora de ir para Tasca do Zé');
    expect(avisos[2].corpo).toContain('12 min a pé');
    expect(avisos[2].corpo).toContain('19:30');
  });

  it('nunca manda o lembrete de planear na véspera do jogo', () => {
    for (const aviso of avisosDoJogo(jogo, equipas, tasco, muitoAntes)) {
      if (aviso.id.endsWith(':plano')) {
        expect(chaveDoDia(aviso.quando)).not.toBe(
          chaveDoDia(new Date(Date.parse(jogo.inicio) - DIA_MS))
        );
      }
    }
  });

  it('com a hora por definir, só o lembrete de planear', () => {
    const avisos = avisosDoJogo({ ...jogo, horaConfirmada: false }, equipas, tasco, muitoAntes);
    expect(avisos.map((aviso) => aviso.id)).toEqual(['porto-benfica:plano']);
  });

  it('sem tasco, o lembrete sugere escolher um e a saída é para o estádio', () => {
    const avisos = avisosDoJogo(jogo, equipas, null, muitoAntes);
    expect(avisos.map((aviso) => aviso.id)).toEqual([
      'porto-benfica:plano',
      'porto-benfica:estadio',
      'porto-benfica:carimbo',
    ]);
    expect(avisos[0].corpo).toContain('Escolhe o tasco');
  });

  it('não agenda o que já passou', () => {
    const noDiaDoJogo = Date.parse('2026-09-19T16:00:00.000Z');
    const avisos = avisosDoJogo(jogo, equipas, tasco, noDiaDoJogo);
    // Já passou a hora de ir para o tasco; falta sair para o estádio e, depois do apito, carimbar.
    expect(avisos.map((aviso) => aviso.id)).toEqual([
      'porto-benfica:estadio',
      'porto-benfica:carimbo',
    ]);
  });
});

describe('aviso do carimbo', () => {
  it('toca pouco depois do apito, para quem lá está', () => {
    const avisos = avisosDoJogo(
      { id: 'jogo-1', inicio: '2026-09-20T19:30:00Z', horaConfirmada: true },
      { casa: 'Académico de Viseu', fora: 'Benfica' },
      null,
      Date.parse('2026-09-20T12:00:00Z')
    );
    const carimbo = avisos.find((aviso) => aviso.id === 'jogo-1:carimbo');
    expect(carimbo?.quando.toISOString()).toBe('2026-09-20T19:45:00.000Z');
    expect(carimbo?.titulo).toBe('Já estás no estádio?');
  });

  it('não avisa de um jogo com hora por confirmar', () => {
    const avisos = avisosDoJogo(
      { id: 'jogo-2', inicio: '2026-09-20T19:30:00Z', horaConfirmada: false },
      { casa: 'Académico de Viseu', fora: 'Benfica' },
      null,
      Date.parse('2026-09-20T12:00:00Z')
    );
    expect(avisos.some((aviso) => aviso.id === 'jogo-2:carimbo')).toBe(false);
  });
});
