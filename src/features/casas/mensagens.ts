import { ClubTripError, type ClubTripErrorReason } from '@/features/casas/types';

// What the fan reads when the server refuses a booking or a cancellation. Every reason has its own sentence.

const AO_INSCREVER: Record<ClubTripErrorReason, string> = {
  wrong_club: 'Esta viagem é para adeptos do clube da Casa. Confirma o teu clube no perfil.',
  bookings_closed: 'As inscrições para esta viagem já fecharam.',
  member_code_required: 'Esta viagem é só para sócios: escreve o código que a Casa te deu.',
  bad_member_code: 'Esse código não está certo. Confirma-o com a Casa.',
  already_in_car: 'Já tens lugar num carro para este jogo.',
  already_on_club_trip: 'Já estás inscrito noutro transporte para este jogo.',
  vehicle_not_empty: 'Não deu para te inscrever. Tenta outra vez.',
  other: 'Não deu para te inscrever. Tenta outra vez.',
};

const AO_CANCELAR: Record<ClubTripErrorReason, string> = {
  ...AO_INSCREVER,
  bookings_closed: 'As inscrições já fecharam: para saíres da viagem, fala com a Casa.',
  vehicle_not_empty: 'Não deu para cancelar. Tenta outra vez.',
  other: 'Não deu para cancelar. Tenta outra vez.',
};

export function mensagemDeRecusa(erro: unknown, acao: 'inscrever' | 'cancelar'): string {
  const reason: ClubTripErrorReason = erro instanceof ClubTripError ? erro.reason : 'other';
  return acao === 'inscrever' ? AO_INSCREVER[reason] : AO_CANCELAR[reason];
}

/** «Em lista de espera (1.º)», or just «Em lista de espera» while the server has not said the place. */
export function textoListaDeEspera(posicao: number | null): string {
  return posicao !== null && posicao > 0 ? `Em lista de espera (${posicao}.º)` : 'Em lista de espera';
}

/** «1 lugar livre», «3 lugares livres», «Cheio». */
export function textoLugaresLivres(livres: number): string {
  if (livres <= 0) return 'Cheio';
  return livres === 1 ? '1 lugar livre' : `${livres} lugares livres`;
}
