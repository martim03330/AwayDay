/**
 * Money is always an integer number of cents: never floats, never parseFloat. Every money calculation in the app
 * goes through this module.
 */

const formatoEuros = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const formatoEurosRedondos = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** The largest price someone can type: 9999,99 €. */
export const PRECO_MAXIMO_CENTIMOS = 999_999;

/** Whether a value is a valid amount of cents (a safe integer). */
export function eCentimos(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor);
}

function exigirCentimos(valor: number) {
  if (!Number.isSafeInteger(valor)) {
    throw new RangeError(`Esperava um número inteiro de cêntimos e recebi ${valor}.`);
  }
  return valor;
}

/** Sum of amounts in cents. Throws if any value is not whole cents or the total leaves the safe integer range. */
export function somarCentimos(...valores: number[]) {
  return valores.reduce((total, valor) => exigirCentimos(total + exigirCentimos(valor)), 0);
}

/** For sorting amounts in cents (cheapest first): negative, zero or positive. */
export function compararCentimos(a: number, b: number) {
  return exigirCentimos(a) - exigirCentimos(b);
}

/**
 * Reads a price typed by a person ("3", "3,5", "3,50", "3.50", "3,50 €") into cents, using only integer maths.
 * Returns `null` for anything that is not a plain price between 0 and 9999,99 €.
 */
export function lerPrecoEmCentimos(texto: string): number | null {
  const limpo = texto.trim().replace(/\s*€$/, '');
  const partes = /^(\d{1,4})(?:[.,](\d{1,2}))?$/.exec(limpo);
  if (!partes) return null;

  const euros = Number(partes[1]);
  const decimais = partes[2] ?? '';
  const centimosDaParteDecimal =
    decimais.length === 0 ? 0 : decimais.length === 1 ? Number(decimais) * 10 : Number(decimais);
  const centimos = euros * 100 + centimosDaParteDecimal;

  return centimos <= PRECO_MAXIMO_CENTIMOS ? centimos : null;
}

/** "3,50 €". The division by 100 is only for display and never feeds back into a calculation. */
export function formatarCentimos(centimos: number) {
  return formatoEuros.format(exigirCentimos(centimos) / 100);
}

/**
 * "50 €" para valores redondos (escalões, rótulos curtos), "3,50 €" para o resto — nunca esconde cêntimos que lá
 * estejam.
 */
export function formatarCentimosCurto(centimos: number) {
  return exigirCentimos(centimos) % 100 === 0
    ? formatoEurosRedondos.format(centimos / 100)
    : formatarCentimos(centimos);
}

const formatosPorMoeda = new Map<string, Intl.NumberFormat>([['EUR', formatoEuros]]);

/**
 * A price in any currency: "3,50 €", "6,50 £", "45,00 NOK". Abroad, dishes are priced in the local currency and
 * `centimos` is in its minor units (pence, øre, fillér), always 2 decimals for the currencies the app uses. Display
 * only, like formatarCentimos. Throws for a malformed currency code.
 */
export function formatarPreco(centimos: number, moeda: string) {
  if (!/^[A-Z]{3}$/.test(moeda)) throw new RangeError(`Moeda inválida: ${moeda}.`);
  let formato = formatosPorMoeda.get(moeda);
  if (!formato) {
    // Always 2 decimals, as the stored minor units have: newer locale data gives some currencies (HUF) no decimals,
    // and Intl would then round 199,50 HUF to «200 HUF», showing a price nobody set.
    formato = new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: moeda,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatosPorMoeda.set(moeda, formato);
  }
  return formato.format(exigirCentimos(centimos) / 100);
}

/**
 * The «cada» of an amount split equally between `pessoas`: the share rounded up to the cent, which is what nobody
 * pays more than (13630 by 4 → 3408, as two pay 3408 and two 3407). The same rule as the server's `ride_share_cents`
 * and `sharePerPersonCents` in supabase/functions/_shared/ride-cost.ts, so every screen shows the same figure for
 * the same ride. Display only: who pays which cent is the server's business (`trip_balances`).
 */
export function parteDeCadaCentimos(totalCentimos: number, pessoas: number) {
  exigirCentimos(totalCentimos);
  if (totalCentimos < 0) throw new RangeError('Um valor a dividir não pode ser negativo.');
  if (!Number.isSafeInteger(pessoas) || pessoas < 1) {
    throw new RangeError(`Esperava pelo menos uma pessoa e recebi ${pessoas}.`);
  }
  const base = Math.floor(totalCentimos / pessoas);
  return totalCentimos % pessoas === 0 ? base : base + 1;
}
