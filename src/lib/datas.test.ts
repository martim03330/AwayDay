import { describe, expect, it } from 'vitest';

import {
  chaveDoDia,
  dataEmLisboaAPartirDe,
  diaDaSemana,
  formatarDia,
  formatarDiaComSemana,
  formatarDiaCurto,
  formatarDiaMes,
  formatarDiaEHora,
  formatarHora,
  minutosDoDiaEmLisboa,
} from '@/lib/datas';

const em = (iso: string) => new Date(iso);

// 2026: summer time starts on Sunday 29 March (01:00 → 02:00) and ends on Sunday 25 October (02:00 → 01:00).

describe('chaveDoDia', () => {
  it('no inverno Lisboa está em UTC', () => {
    expect(chaveDoDia(em('2026-01-15T23:30:00Z'))).toBe('2026-01-15');
  });

  it('no verão as 23:30 UTC já são o dia seguinte em Lisboa', () => {
    expect(chaveDoDia(em('2026-07-15T23:30:00Z'))).toBe('2026-07-16');
    expect(chaveDoDia(em('2026-12-31T23:30:00Z'))).toBe('2026-12-31');
    expect(chaveDoDia(em('2026-08-31T23:00:00Z'))).toBe('2026-09-01');
  });
});

describe('minutosDoDiaEmLisboa', () => {
  it('conta a partir da meia-noite de Lisboa, no inverno e no verão', () => {
    expect(minutosDoDiaEmLisboa(em('2026-01-15T20:30:00Z'))).toBe(20 * 60 + 30);
    expect(minutosDoDiaEmLisboa(em('2026-07-15T19:30:00Z'))).toBe(20 * 60 + 30);
    expect(minutosDoDiaEmLisboa(em('2026-07-15T23:00:00Z'))).toBe(0);
    expect(minutosDoDiaEmLisboa(em('2026-01-15T23:59:00Z'))).toBe(1439);
  });

  it('nos dias em que a hora muda', () => {
    expect(minutosDoDiaEmLisboa(em('2026-03-29T00:59:00Z'))).toBe(59);
    expect(minutosDoDiaEmLisboa(em('2026-03-29T01:00:00Z'))).toBe(120);
    expect(minutosDoDiaEmLisboa(em('2026-10-25T00:30:00Z'))).toBe(90);
    expect(minutosDoDiaEmLisboa(em('2026-10-25T01:30:00Z'))).toBe(90);
  });
});

describe('formatarHora', () => {
  it('mostra a hora de Lisboa', () => {
    expect(formatarHora(em('2026-01-15T20:30:00Z'))).toBe('20:30');
    expect(formatarHora(em('2026-07-15T19:30:00Z'))).toBe('20:30');
  });
});

describe('dataEmLisboaAPartirDe', () => {
  it('no inverno e no verão', () => {
    expect(dataEmLisboaAPartirDe(em('2026-01-15T10:00:00Z'), 0, '20:30').toISOString()).toBe(
      '2026-01-15T20:30:00.000Z'
    );
    expect(dataEmLisboaAPartirDe(em('2026-07-15T10:00:00Z'), 2, '20:30').toISOString()).toBe(
      '2026-07-17T19:30:00.000Z'
    );
  });

  it('conta os dias a partir do dia de Lisboa, não do dia UTC', () => {
    // 23:30Z de 15 de julho já é dia 16 em Lisboa.
    expect(dataEmLisboaAPartirDe(em('2026-07-15T23:30:00Z'), 0, '10:00').toISOString()).toBe(
      '2026-07-16T09:00:00.000Z'
    );
  });

  it('atravessa a mudança de hora com a hora certa dos dois lados', () => {
    expect(dataEmLisboaAPartirDe(em('2026-03-28T12:00:00Z'), 2, '20:00').toISOString()).toBe(
      '2026-03-30T19:00:00.000Z'
    );
    expect(dataEmLisboaAPartirDe(em('2026-10-24T12:00:00Z'), 2, '20:00').toISOString()).toBe(
      '2026-10-26T20:00:00.000Z'
    );
  });

  it('no dia em que a hora avança, 01:30 não existe e passa para as 02:30 de Lisboa', () => {
    const data = dataEmLisboaAPartirDe(em('2026-03-28T12:00:00Z'), 1, '01:30');
    expect(data.toISOString()).toBe('2026-03-29T01:30:00.000Z');
    expect(formatarHora(data)).toBe('02:30');
    // As horas à volta da falha continuam certas.
    expect(dataEmLisboaAPartirDe(em('2026-03-28T12:00:00Z'), 1, '00:59').toISOString()).toBe(
      '2026-03-29T00:59:00.000Z'
    );
    expect(dataEmLisboaAPartirDe(em('2026-03-28T12:00:00Z'), 1, '02:00').toISOString()).toBe(
      '2026-03-29T01:00:00.000Z'
    );
    expect(dataEmLisboaAPartirDe(em('2026-03-28T12:00:00Z'), 1, '03:00').toISOString()).toBe(
      '2026-03-29T02:00:00.000Z'
    );
  });

  it('no dia em que a hora recua, 01:30 acontece duas vezes e fica a primeira', () => {
    const data = dataEmLisboaAPartirDe(em('2026-10-24T12:00:00Z'), 1, '01:30');
    expect(data.toISOString()).toBe('2026-10-25T00:30:00.000Z');
    expect(formatarHora(data)).toBe('01:30');
    expect(dataEmLisboaAPartirDe(em('2026-10-24T12:00:00Z'), 1, '02:30').toISOString()).toBe(
      '2026-10-25T02:30:00.000Z'
    );
    expect(dataEmLisboaAPartirDe(em('2026-10-24T12:00:00Z'), 1, '00:30').toISOString()).toBe(
      '2026-10-24T23:30:00.000Z'
    );
  });
});

describe('formatarDia', () => {
  const agora = Date.parse('2026-07-15T10:00:00Z');

  it('hoje, amanhã e ontem pelo dia de Lisboa', () => {
    expect(formatarDia(em('2026-07-15T21:00:00Z'), agora)).toBe('Hoje');
    expect(formatarDia(em('2026-07-15T23:30:00Z'), agora)).toBe('Amanhã');
    expect(formatarDia(em('2026-07-14T23:00:00Z'), agora)).toBe('Hoje');
    expect(formatarDia(em('2026-07-14T22:59:00Z'), agora)).toBe('Ontem');
    expect(formatarDia(em('2026-07-14T12:00:00Z'), agora)).toBe('Ontem');
  });

  it('o resto com o dia da semana', () => {
    expect(formatarDia(em('2026-09-19T19:00:00Z'), agora)).toBe('sábado, 19 de setembro');
  });

  it('diz «Ontem» logo depois da meia-noite do dia em que a hora avançou', () => {
    // 23:30Z de 29 de março = 00:30 de 30 de março em Lisboa; o dia 29 teve só 23 horas.
    expect(formatarDia(em('2026-03-29T12:00:00Z'), Date.parse('2026-03-29T23:30:00Z'))).toBe('Ontem');
    expect(formatarDia(em('2026-03-30T12:00:00Z'), Date.parse('2026-03-29T23:30:00Z'))).toBe('Hoje');
  });

  it('diz «Amanhã» à meia-noite do dia em que a hora recua', () => {
    // 23:00Z de 24 de outubro = 00:00 de 25 de outubro em Lisboa; o dia 25 tem 25 horas.
    const meiaNoite = Date.parse('2026-10-24T23:00:00Z');
    expect(formatarDia(em('2026-10-25T12:00:00Z'), meiaNoite)).toBe('Hoje');
    expect(formatarDia(em('2026-10-26T12:00:00Z'), meiaNoite)).toBe('Amanhã');
    expect(formatarDia(em('2026-10-24T12:00:00Z'), meiaNoite)).toBe('Ontem');
  });

  it('atravessa o fim do mês e do ano', () => {
    expect(formatarDia(em('2027-01-01T12:00:00Z'), Date.parse('2026-12-31T12:00:00Z'))).toBe('Amanhã');
    expect(formatarDia(em('2026-12-31T12:00:00Z'), Date.parse('2027-01-01T12:00:00Z'))).toBe('Ontem');
    expect(formatarDia(em('2026-03-01T12:00:00Z'), Date.parse('2026-02-28T12:00:00Z'))).toBe('Amanhã');
  });
});

describe('formatarDiaEHora', () => {
  it('junta o dia e a hora de Lisboa', () => {
    expect(formatarDiaEHora(em('2026-07-15T19:30:00Z'), Date.parse('2026-07-15T10:00:00Z'))).toBe(
      'Hoje às 20:30'
    );
  });
});

describe('datas curtas', () => {
  const agora = Date.parse('2026-10-12T12:00:00Z');

  it('day and month in Lisbon, also late at night (UTC is still the day before)', () => {
    expect(formatarDiaMes(new Date('2026-10-15T19:00:00Z'))).toBe('15/10');
    expect(formatarDiaMes(new Date('2026-10-14T23:30:00Z'))).toBe('15/10');
  });

  it('weekday in Portuguese', () => {
    expect(diaDaSemana(new Date('2026-10-15T19:00:00Z'))).toBe('5.ª feira');
    expect(diaDaSemana(new Date('2026-10-17T19:00:00Z'))).toBe('sábado');
    expect(diaDaSemana(new Date('2026-10-18T19:00:00Z'))).toBe('domingo');
  });

  it('today and tomorrow stay as words', () => {
    expect(formatarDiaCurto(new Date('2026-10-12T19:00:00Z'), agora)).toBe('Hoje');
    expect(formatarDiaCurto(new Date('2026-10-13T19:00:00Z'), agora)).toBe('Amanhã');
    expect(formatarDiaCurto(new Date('2026-10-15T19:00:00Z'), agora)).toBe('15/10');
  });

  it('game list titles: «15/10 (5.ª feira)»', () => {
    expect(formatarDiaComSemana(new Date('2026-10-15T19:00:00Z'), agora)).toBe('15/10 (5.ª feira)');
    expect(formatarDiaComSemana(new Date('2026-10-12T19:00:00Z'), agora)).toBe('Hoje');
  });
});
