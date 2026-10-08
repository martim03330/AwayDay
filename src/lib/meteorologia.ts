import type { Meteorologia, Venue } from '@/mocks/tipos';

/** A partir desta probabilidade (%) consideramos que há previsão de chuva. */
export const LIMIAR_PROBABILIDADE_CHUVA = 40;

export function haPrevisaoDeChuva(meteorologia: Meteorologia | null) {
  if (!meteorologia) return false;
  return (
    meteorologia.condicao === 'chuva' ||
    meteorologia.condicao === 'aguaceiros' ||
    (meteorologia.probabilidadeChuva ?? 0) >= LIMIAR_PROBABILIDADE_CHUVA
  );
}

/**
 * Aviso para mostrar na ficha do jogo: primeiro um aviso do IPMA para a zona do estádio (qualquer cobertura), depois
 * chuva num estádio que não é todo coberto.
 */
export function avisoMeteorologico(meteorologia: Meteorologia | null, venue: Pick<Venue, 'roofCoverage'>) {
  if (!meteorologia) return null;
  const { aviso } = meteorologia;
  if (aviso) {
    return {
      titulo: `Aviso ${aviso.nivel} do IPMA`,
      mensagem: `${aviso.tipo} (aviso ${aviso.nivel}) na zona do estádio à hora do jogo. Vai com tempo e atento às indicações.`,
    };
  }
  if (!haPrevisaoDeChuva(meteorologia) || venue.roofCoverage === 'total') return null;

  const chuva =
    meteorologia.probabilidadeChuva !== null && meteorologia.probabilidadeChuva > 0
      ? `${meteorologia.probabilidadeChuva}% de probabilidade de chuva`
      : 'Chuva prevista';
  return {
    titulo: 'Vem aí chuva',
    mensagem:
      venue.roofCoverage === 'parcial'
        ? `${chuva} e o estádio só tem cobertura parcial. Leva impermeável ou escolhe bem o lugar.`
        : venue.roofCoverage === 'nenhuma'
          ? `${chuva} e o estádio não tem cobertura. Impermeável no bolso.`
          : `${chuva} e ainda não sabemos se a bancada é coberta. Leva impermeável, por via das dúvidas.`,
  };
}
