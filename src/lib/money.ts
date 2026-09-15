/**
 * Money is always an integer number of cents: never floats, never parseFloat. Every money calculation in the app
 * goes through this module.
 */

const formatoEuros = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

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
