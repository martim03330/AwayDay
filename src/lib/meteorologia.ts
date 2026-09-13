import type { Meteorologia, Venue } from '@/mocks/tipos';

/** A partir desta probabilidade (%) consideramos que há previsão de chuva. */
export const LIMIAR_PROBABILIDADE_CHUVA = 40;

export function haPrevisaoDeChuva(meteorologia: Meteorologia) {
  return (
    meteorologia.condicao === 'chuva' ||
    meteorologia.condicao === 'aguaceiros' ||
    meteorologia.probabilidadeChuva >= LIMIAR_PROBABILIDADE_CHUVA
  );
}

/** Aviso para mostrar na ficha do jogo quando vai chover e o estádio não é todo coberto. */
export function avisoDeChuva(meteorologia: Meteorologia, venue: Pick<Venue, 'roofCoverage'>) {
  if (!haPrevisaoDeChuva(meteorologia) || venue.roofCoverage === 'total') return null;

  const probabilidade = `${meteorologia.probabilidadeChuva}%`;
  return {
    titulo: 'Previsão de chuva',
    mensagem:
      venue.roofCoverage === 'parcial'
        ? `${probabilidade} de probabilidade de chuva e o estádio só tem cobertura parcial. Leva impermeável ou escolhe um lugar coberto.`
        : `${probabilidade} de probabilidade de chuva e o estádio não tem cobertura. Leva impermeável.`,
  };
}
