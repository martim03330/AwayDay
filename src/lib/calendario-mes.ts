import { chaveDoDia } from '@/lib/datas';

/**
 * The month grid of the games calendar («Mês»): weeks from Monday to Sunday, with the days of the neighbouring months
 * filling the first and last week. Days are Lisbon days (`chaveDoDia`), so a 00:30 kick-off lands on the right one.
 */

export type MesDoCalendario = { ano: number; mes: number };

export type DiaDoCalendario = {
  /** "2026-10-15", the same key as `chaveDoDia`. */
  chave: string;
  dia: number;
  /** False for the days of the previous or next month that complete the first and last week. */
  doMes: boolean;
};

const DIA_MS = 24 * 60 * 60 * 1000;

const nomeDoMes = new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', month: 'long', year: 'numeric' });

function chaveUtc(data: Date) {
  return data.toISOString().slice(0, 10);
}

/** The month of a day key ("2026-10-15" → outubro de 2026). */
export function mesDaChave(chave: string): MesDoCalendario {
  const [ano, mes] = chave.split('-').map(Number);
  return { ano, mes };
}

/** The month of an instant, in Lisbon. */
export function mesEmLisboa(data: Date): MesDoCalendario {
  return mesDaChave(chaveDoDia(data));
}

export function somarMeses({ ano, mes }: MesDoCalendario, quantos: number): MesDoCalendario {
  const indice = ano * 12 + (mes - 1) + quantos;
  return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

/** Negative when `a` is before `b`, zero for the same month. */
export function compararMeses(a: MesDoCalendario, b: MesDoCalendario) {
  return a.ano * 12 + a.mes - (b.ano * 12 + b.mes);
}

/** "Outubro de 2026" */
export function tituloDoMes({ ano, mes }: MesDoCalendario) {
  const texto = nomeDoMes.format(new Date(Date.UTC(ano, mes - 1, 1)));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** The weeks of the month, Monday first, each with exactly seven days. */
export function semanasDoMes({ ano, mes }: MesDoCalendario): DiaDoCalendario[][] {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
  // getUTCDay: 0 is Sunday. Days to go back to that week's Monday.
  const recuar = (primeiro.getUTCDay() + 6) % 7;
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const total = Math.ceil((recuar + diasNoMes) / 7) * 7;
  const inicio = primeiro.getTime() - recuar * DIA_MS;

  const semanas: DiaDoCalendario[][] = [];
  for (let i = 0; i < total; i += 1) {
    const data = new Date(inicio + i * DIA_MS);
    if (i % 7 === 0) semanas.push([]);
    semanas[semanas.length - 1].push({
      chave: chaveUtc(data),
      dia: data.getUTCDate(),
      doMes: data.getUTCMonth() === mes - 1,
    });
  }
  return semanas;
}

/** Games by Lisbon day key, keeping the order they came in (the catalogue is sorted by kick-off). */
export function agruparPorChaveDoDia<T extends { inicio: string }>(lista: readonly T[]) {
  const porDia = new Map<string, T[]>();
  for (const item of lista) {
    const chave = chaveDoDia(new Date(item.inicio));
    const dia = porDia.get(chave);
    if (dia) dia.push(item);
    else porDia.set(chave, [item]);
  }
  return porDia;
}
