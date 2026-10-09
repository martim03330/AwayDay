/** The longest side of an uploaded photo: sharp on any phone screen, a fraction of a 12 MP original. */
export const LADO_MAXIMO_PX = 1600;

/**
 * How to resize a photo before upload: the longest side down to LADO_MAXIMO_PX, keeping the proportions (only one side
 * is given, the other follows). `null` when it is already small enough: a photo is never made bigger.
 */
export function medidaParaEnviar(largura: number, altura: number): { width: number } | { height: number } | null {
  if (!(largura > 0) || !(altura > 0)) return null;
  if (Math.max(largura, altura) <= LADO_MAXIMO_PX) return null;
  return largura >= altura ? { width: LADO_MAXIMO_PX } : { height: LADO_MAXIMO_PX };
}
