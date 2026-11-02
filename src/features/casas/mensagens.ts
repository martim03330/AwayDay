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

// What a manager (or someone registering a Casa) reads when the server refuses. The functions raise a short code;
// the ones the app does not know by name arrive as 'other' with the code as the message.
const NA_GESTAO = new Map<string, string>(
  Object.entries({
    vehicle_full: 'Esse transporte não tem lugar para todos os desta inscrição.',
    vehicle_not_empty: 'Esse transporte ainda tem pessoas: muda-as primeiro para outro.',
    last_vehicle: 'A viagem precisa de pelo menos um transporte.',
    too_many_vehicles: 'Uma viagem tem no máximo 10 transportes.',
    bad_vehicle: 'Confirma o nome e os lugares do transporte (de 1 a 80).',
    trip_cancelled: 'Esta viagem já foi cancelada.',
    booking_cancelled: 'Essa inscrição já não está na viagem.',
    not_booked: 'Só quem tem lugar num transporte pode entrar.',
    too_many_bookings: 'Esta viagem já tem inscrições a mais.',
    bad_stop: 'Confirma as paragens: nome e hora antes do jogo.',
    bad_stops: 'Uma viagem tem de 1 a 8 paragens.',
    bad_vehicles: 'Uma viagem tem de 1 a 10 transportes.',
    bad_body: 'Escreve o aviso (até 500 letras).',
    too_many_notices: 'Já enviaste 10 avisos hoje para esta viagem.',
    bad_bookings_close_at: 'O prazo das inscrições tem de ser depois de agora e antes do jogo.',
    bad_price: 'O preço por pessoa vai de 0 a 1000 €.',
    bad_note: 'A nota tem no máximo 300 letras.',
    wrong_fixture: 'A Casa só organiza viagens para jogos do seu clube.',
    fixture_started: 'Esse jogo já começou.',
    club_not_verified: 'A Casa ainda está à espera de aprovação.',
    club_suspended: 'Esta Casa está suspensa.',
    not_manager: 'Só quem gere a Casa pode fazer isto.',
    not_owner: 'Só o dono da Casa pode fazer isto.',
    last_owner: 'A Casa não pode ficar sem dono.',
    bad_name: 'Confirma o nome: é curto demais ou comprido demais.',
    bad_email: 'Esse email não parece certo.',
    name_taken: 'Já há uma Casa com esse nome neste clube.',
    too_many_pending: 'Já tens pedidos à espera de aprovação.',
    club_not_found: 'Escolhe o clube da Casa.',
    municipality_not_found: 'Escolhe o concelho da Casa.',
    invite_not_found: 'Esse código não existe. Confirma-o com quem gere a Casa.',
    invite_used: 'Esse código já foi usado. Pede um novo a quem gere a Casa.',
    invite_expired: 'Esse código já expirou. Pede um novo a quem gere a Casa.',
    rate_limited: 'Fizeste isto muitas vezes seguidas. Tenta mais tarde.',
  })
);

export function mensagemDaGestao(erro: unknown): string {
  if (erro instanceof ClubTripError) {
    const texto = NA_GESTAO.get(erro.reason) ?? NA_GESTAO.get(erro.message);
    if (texto) return texto;
  }
  return 'Não deu. Tenta outra vez daqui a pouco.';
}
