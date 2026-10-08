/**
 * Splits a long text into pieces of at most `tamanho` characters, and joins them back. The phone's secure storage
 * (Keychain / Keystore) refuses long values on some devices, and a Supabase session is longer than that.
 */
export function partirEmPedacos(texto: string, tamanho: number): string[] {
  if (tamanho < 1) throw new Error('The piece size must be positive.');
  const pedacos: string[] = [];
  for (let inicio = 0; inicio < texto.length; inicio += tamanho) pedacos.push(texto.slice(inicio, inicio + tamanho));
  return pedacos.length > 0 ? pedacos : [''];
}

/** `null` when a piece is missing: a half-written value is worth nothing. */
export function juntarPedacos(pedacos: readonly (string | null)[]): string | null {
  return pedacos.some((pedaco) => pedaco === null) ? null : pedacos.join('');
}
