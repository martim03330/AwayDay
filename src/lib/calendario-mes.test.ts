import { describe, expect, it } from 'vitest';

import {
  agruparPorChaveDoDia,
  compararMeses,
  mesEmLisboa,
  semanasDoMes,
  somarMeses,
  tituloDoMes,
} from '@/lib/calendario-mes';

describe('semanasDoMes', () => {
  it('starts on Monday and fills the first week with the previous month', () => {
    // 1 October 2026 is a Thursday.
    const semanas = semanasDoMes({ ano: 2026, mes: 10 });
    expect(semanas[0].map((dia) => dia.chave)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(semanas[0].map((dia) => dia.doMes)).toEqual([false, false, false, true, true, true, true]);
  });

  it('always has whole weeks, ending with the next month', () => {
    const semanas = semanasDoMes({ ano: 2026, mes: 10 });
    expect(semanas.every((semana) => semana.length === 7)).toBe(true);
    expect(semanas).toHaveLength(5);
    expect(semanas.at(-1)?.at(-1)).toEqual({ chave: '2026-11-01', dia: 1, doMes: false });
    expect(semanas.flat().filter((dia) => dia.doMes)).toHaveLength(31);
  });

  it('handles a month that starts on Sunday (six weeks)', () => {
    // 1 November 2026 is a Sunday: six days of October before it.
    const semanas = semanasDoMes({ ano: 2026, mes: 11 });
    expect(semanas[0].filter((dia) => !dia.doMes)).toHaveLength(6);
    expect(semanas[0][6].chave).toBe('2026-11-01');
    expect(semanas).toHaveLength(6);
  });

  it('handles a month that starts on Monday with no filler before it', () => {
    // 1 February 2027 is a Monday, and February 2027 has exactly four weeks.
    const semanas = semanasDoMes({ ano: 2027, mes: 2 });
    expect(semanas[0][0]).toEqual({ chave: '2027-02-01', dia: 1, doMes: true });
    expect(semanas).toHaveLength(4);
  });

  it('knows leap years', () => {
    const dias = (ano: number) =>
      semanasDoMes({ ano, mes: 2 })
        .flat()
        .filter((dia) => dia.doMes).length;
    expect(dias(2028)).toBe(29);
    expect(dias(2027)).toBe(28);
    expect(dias(2100)).toBe(28);
  });

  it('crosses the end of the year', () => {
    const semanas = semanasDoMes({ ano: 2026, mes: 12 });
    expect(semanas.at(-1)?.at(-1)?.chave).toBe('2027-01-03');
  });
});

describe('months', () => {
  it('adds months across years', () => {
    expect(somarMeses({ ano: 2026, mes: 12 }, 1)).toEqual({ ano: 2027, mes: 1 });
    expect(somarMeses({ ano: 2027, mes: 1 }, -1)).toEqual({ ano: 2026, mes: 12 });
    expect(somarMeses({ ano: 2026, mes: 10 }, 14)).toEqual({ ano: 2027, mes: 12 });
  });

  it('compares months', () => {
    expect(compararMeses({ ano: 2026, mes: 12 }, { ano: 2027, mes: 1 })).toBeLessThan(0);
    expect(compararMeses({ ano: 2027, mes: 1 }, { ano: 2027, mes: 1 })).toBe(0);
  });

  it('names the month in Portuguese, capitalised', () => {
    expect(tituloDoMes({ ano: 2026, mes: 10 })).toBe('Outubro de 2026');
  });

  it('takes the month in Lisbon, not UTC', () => {
    // 31 October 2026 23:30 UTC is still 31 October in Lisbon (winter time, UTC+0).
    expect(mesEmLisboa(new Date('2026-10-31T23:30:00Z'))).toEqual({ ano: 2026, mes: 10 });
    // 30 September 2026 23:30 UTC is 1 October 00:30 in Lisbon (summer time, UTC+1).
    expect(mesEmLisboa(new Date('2026-09-30T23:30:00Z'))).toEqual({ ano: 2026, mes: 10 });
  });
});

describe('agruparPorChaveDoDia', () => {
  it('puts a game on its Lisbon day, also around midnight', () => {
    const jogos = [
      { id: 'a', inicio: '2026-10-15T19:00:00Z' },
      { id: 'b', inicio: '2026-10-15T23:30:00Z' }, // 00:30 on the 16th in Lisbon (summer time)
      { id: 'c', inicio: '2026-10-15T20:45:00Z' },
    ];
    const porDia = agruparPorChaveDoDia(jogos);
    expect(porDia.get('2026-10-15')?.map((jogo) => jogo.id)).toEqual(['a', 'c']);
    expect(porDia.get('2026-10-16')?.map((jogo) => jogo.id)).toEqual(['b']);
  });
});
