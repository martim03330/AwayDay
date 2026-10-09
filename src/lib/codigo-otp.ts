/** Six digits, spaces ignored (authenticator apps show «123 456»); `null` for anything else. */
export function lerCodigo(texto: string): string | null {
  const digitos = texto.replace(/\s+/g, '');
  return /^\d{6}$/.test(digitos) ? digitos : null;
}
