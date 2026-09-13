const IDIOMA = 'pt-PT';

const formatoPreco = new Intl.NumberFormat(IDIOMA, { style: 'currency', currency: 'EUR' });
const formatoNumero = new Intl.NumberFormat(IDIOMA);
const formatoAteUmaCasa = new Intl.NumberFormat(IDIOMA, { maximumFractionDigits: 1 });
const formatoUmaCasa = new Intl.NumberFormat(IDIOMA, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** "1,85 €" ou "Grátis" */
export function formatarPreco(euros: number) {
  return euros === 0 ? 'Grátis' : formatoPreco.format(euros);
}

/** "64 642" */
export function formatarNumero(valor: number) {
  return formatoNumero.format(valor);
}

/** "350 m" ou "1,2 km" */
export function formatarDistancia(metros: number) {
  return metros < 1000 ? `${metros} m` : `${formatoAteUmaCasa.format(metros / 1000)} km`;
}

/** "4,2 km" abaixo de 10 km, "312 km" a partir daí */
export function formatarKm(km: number) {
  return km < 10 ? `${formatoUmaCasa.format(km)} km` : `${formatoNumero.format(Math.round(km))} km`;
}

/** "45 min", "3 h" ou "3 h 40 min" */
export function formatarDuracao(minutos: number) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

/** "4,3" */
export function formatarNota(nota: number) {
  return formatoUmaCasa.format(nota);
}

export function plural(quantidade: number, singular: string, pluralForma: string) {
  return `${quantidade} ${quantidade === 1 ? singular : pluralForma}`;
}
