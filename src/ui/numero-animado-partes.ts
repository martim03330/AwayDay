/** One piece of a formatted number: a digit that can roll, or text that stays still. */
export type ParteDoNumero = {
  /** Stable across value changes: digits are keyed by their place counted from the right of the number. */
  chave: string;
  texto: string;
  digito: boolean;
};

// Prefix, the number itself (digits with group or decimal separators inside), suffix.
const PADRAO = /^(\D*)(\d(?:[\d\s.,  ]*\d)?)([\s\S]*)$/;

/**
 * Splits a formatted number ("1 200 pts", "12.º", "3 lugares") into pieces for the per-digit roll.
 *
 * Digits are keyed by their place from the right (units, tens…), so going from 99 to 100 only adds a new place and
 * the units stay the units. Text before and after the number keeps one key each, so «1 estádio» → «2 estádios»
 * rolls only the digit. Text with no digit at all comes back as one still piece.
 */
export function partesDoNumero(texto: string): ParteDoNumero[] {
  const partes = PADRAO.exec(texto);
  if (!partes) return texto ? [{ chave: 'texto', texto, digito: false }] : [];

  const [, antes = '', numero = '', depois = ''] = partes;
  const resultado: ParteDoNumero[] = [];
  if (antes) resultado.push({ chave: 'antes', texto: antes, digito: false });
  const caracteres = Array.from(numero);
  caracteres.forEach((caractere, indice) => {
    const daDireita = caracteres.length - 1 - indice;
    const digito = caractere >= '0' && caractere <= '9';
    resultado.push({ chave: `${digito ? 'd' : 's'}${daDireita}`, texto: caractere, digito });
  });
  if (depois) resultado.push({ chave: 'depois', texto: depois, digito: false });
  return resultado;
}
