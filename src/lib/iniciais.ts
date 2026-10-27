/**
 * "Martim Henriques" -> "MH". Only letters count: "Tiago (teste)" -> "T", never "T(".
 * First letter of the first and of the last word that starts with a letter (accents kept: "Élio" -> "É").
 */
export function iniciais(nome: string) {
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((palavra) => /^\p{L}/u.test(palavra));
  if (partes.length === 0) return '?';
  const primeira = Array.from(partes[0])[0] ?? '';
  const ultima = partes.length > 1 ? (Array.from(partes[partes.length - 1])[0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}
