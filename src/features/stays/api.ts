import { supabase } from '@/lib/supabase';

// Dormir fora, em jogos no estrangeiro e nas ilhas: casas propostas pelos adeptos e divididas como as boleias.
// A app não guarda disponibilidade nem preços de anúncios — isso vê-se no Airbnb. Guarda quem propôs o quê, quanto
// custa a casa toda e quem já entrou; a conta por pessoa é feita no servidor.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type StayRefusal =
  | 'not_signed_in'
  | 'stay_not_needed'
  | 'needs_history'
  | 'bad_stay'
  | 'outside_window'
  | 'rate_limited'
  | 'own_house'
  | 'house_full'
  | 'house_not_found'
  | 'not_owner'
  | 'request_not_found'
  | 'unknown';

export class StayRefused extends Error {
  readonly reason: StayRefusal;

  constructor(reason: StayRefusal) {
    super(reason);
    this.name = 'StayRefused';
    this.reason = reason;
  }
}

const RECUSAS: StayRefusal[] = [
  'not_signed_in',
  'stay_not_needed',
  'needs_history',
  'bad_stay',
  'outside_window',
  'rate_limited',
  'own_house',
  'house_full',
  'house_not_found',
  'not_owner',
  'request_not_found',
];

function refusal(error: { message: string }) {
  return new StayRefused(RECUSAS.find((reason) => error.message === reason) ?? 'unknown');
}

/** De quem propõe a casa: 'certo' reserva de qualquer maneira, 'se_houver' só se a casa encher. */
export type StayCommitment = 'certo' | 'se_houver';
export type StayPlaceStatus = 'pedido' | 'aceite' | 'recusado' | 'saiu';

/** O pouco que a app sabe mesmo sobre alguém — e que é verdade, ao contrário de uma fotografia qualquer. */
export type TrustSigns = {
  /** Desde quando tem conta. */
  memberSince: string;
  ridesCompleted: number;
  ridesFaults: number;
};

export type StayHouse = TrustSigns & {
  id: string;
  displayName: string;
  /** O que a casa custa ao todo, em cêntimos inteiros. */
  totalCents: number;
  nights: number;
  commitment: StayCommitment;
  /** Lugares para além de quem a propôs. */
  sparePlaces: number;
  taken: number;
  /** O que cada um paga com a gente que já entrou, e com a casa cheia. */
  shareNowCents: number;
  shareFullCents: number;
  /** O anúncio que a pessoa viu, e o dia em que o viu. Pode já não estar disponível: quem abre, confirma. */
  listingUrl: string | null;
  listingSeenOn: string | null;
  status: 'a_juntar' | 'reservada';
  note: string | null;
  updatedOn: string;
  isMine: boolean;
  myStatus: StayPlaceStatus | null;
  /** Pedidos à espera de resposta (só a quem propôs a casa). */
  pending: number;
};

export type StayPlacePerson = TrustSigns & {
  profileId: string;
  displayName: string;
  status: StayPlaceStatus;
  isMine: boolean;
};

function toCommitment(value: string | null): StayCommitment {
  return value === 'certo' ? 'certo' : 'se_houver';
}

function toPlaceStatus(value: string | null): StayPlaceStatus | null {
  return value === 'pedido' || value === 'aceite' || value === 'recusado' || value === 'saiu'
    ? value
    : null;
}

/** As casas propostas para este jogo. As já reservadas ficam no fim. */
export async function fetchStayHouses(fixtureId: string): Promise<StayHouse[]> {
  const { data, error } = await client().rpc('fixture_stay_plans', { p_fixture_id: fixtureId });
  if (error) throw error;
  // O servidor devolve colunas anuláveis; uma linha sem o essencial não se mostra a ninguém.
  return data.flatMap((row) =>
    row.total_cents === null || row.nights === null || row.spare_places === null
      ? []
      : [
          {
            id: row.id,
            displayName: row.display_name ?? 'Um adepto',
            memberSince: row.member_since ?? '',
            ridesCompleted: row.rides_completed ?? 0,
            ridesFaults: row.rides_faults ?? 0,
            totalCents: row.total_cents,
            nights: row.nights,
            commitment: toCommitment(row.commitment),
            sparePlaces: row.spare_places,
            taken: row.taken ?? 0,
            shareNowCents: row.share_now_cents ?? row.total_cents,
            shareFullCents: row.share_full_cents ?? row.total_cents,
            listingUrl: row.listing_url,
            listingSeenOn: row.listing_seen_on,
            status: row.status === 'reservada' ? ('reservada' as const) : ('a_juntar' as const),
            note: row.note,
            updatedOn: row.updated_on ?? '',
            isMine: row.is_mine === true,
            myStatus: toPlaceStatus(row.my_status),
            pending: row.pending ?? 0,
          },
        ]
  );
}

export type NewStayHouse = {
  nights: number;
  totalCents: number;
  sparePlaces: number;
  commitment: StayCommitment;
  listingUrl: string | null;
  note: string;
};

/** Propõe (ou corrige) a tua casa para este jogo. Uma por pessoa e por jogo. */
export async function setStayHouse(fixtureId: string, casa: NewStayHouse) {
  const { error } = await client().rpc('set_stay_plan', {
    p_fixture_id: fixtureId,
    p_nights: casa.nights,
    p_total_cents: casa.totalCents,
    p_spare_places: casa.sparePlaces,
    p_commitment: casa.commitment,
    p_note: casa.note.trim(),
    p_listing_url: casa.listingUrl?.trim() || undefined,
  });
  if (error) throw refusal(error);
}

/** Desisti da casa que propus. */
export async function removeStayHouse(fixtureId: string) {
  const { error } = await client().rpc('remove_stay_plan', { p_fixture_id: fixtureId });
  if (error) throw refusal(error);
}

/** Pede lugar numa casa. Quem a propôs é que decide, como na boleia. */
export async function requestStayPlace(planId: string) {
  const { error } = await client().rpc('request_stay_place', { p_plan_id: planId });
  if (error) throw refusal(error);
}

export async function answerStayPlace(planId: string, profileId: string, accept: boolean) {
  const { error } = await client().rpc('answer_stay_place', {
    p_plan_id: planId,
    p_profile_id: profileId,
    p_accept: accept,
  });
  if (error) throw refusal(error);
}

/** Sair da casa, ou retirar o pedido. */
export async function leaveStayPlace(planId: string) {
  const { error } = await client().rpc('leave_stay_place', { p_plan_id: planId });
  if (error) throw refusal(error);
}

/** Quem propôs marca a casa como reservada (ou volta atrás). */
export async function markStayHouse(planId: string, booked: boolean) {
  const { error } = await client().rpc('mark_stay_house', { p_plan_id: planId, p_booked: booked });
  if (error) throw refusal(error);
}

/** Quem está numa casa: os aceites vêem-se todos, os pedidos por responder só quem propôs a casa. */
export async function fetchStayPlacePeople(planId: string): Promise<StayPlacePerson[]> {
  const { data, error } = await client().rpc('stay_place_people', { p_plan_id: planId });
  if (error) throw error;
  return data.flatMap((row) => {
    const status = toPlaceStatus(row.status);
    return status
      ? [
          {
            profileId: row.profile_id,
            displayName: row.display_name ?? 'Um adepto',
            memberSince: row.member_since ?? '',
            ridesCompleted: row.rides_completed ?? 0,
            ridesFaults: row.rides_faults ?? 0,
            status,
            isMine: row.is_mine === true,
          },
        ]
      : [];
  });
}

/** Se a app deixa esta pessoa propor ou entrar numa casa: conta com mais de uma semana ou uma boleia feita. */
export async function canShareHouse(profileId: string): Promise<boolean> {
  const { data, error } = await client().rpc('can_share_house', { p_profile_id: profileId });
  if (error) throw error;
  return data === true;
}
