import { supabase } from '@/lib/supabase';

// Onde dormir, em jogos no estrangeiro e nas ilhas. A app não guarda disponibilidade nem preços de anúncios: guarda
// o que as pessoas propõem. Alguém vê uma casa, propõe-na com o custo total, e a malta junta-se — o preço por pessoa
// desce a cada um que entra, e quem propôs aceita ou recusa, como na boleia.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type StayRefusal =
  | 'not_signed_in'
  | 'stay_not_needed'
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

/** 'tem_casa': propôs uma casa concreta. 'procura': só disse que precisa de cama. */
export type StayKind = 'procura' | 'tem_casa';
/** De quem propõe a casa: 'certo' reserva de qualquer maneira, 'se_houver' só se a casa encher. */
export type StayCommitment = 'certo' | 'se_houver';
export type StayPlaceStatus = 'pedido' | 'aceite' | 'recusado' | 'saiu';

export type StayPlan = {
  id: string;
  displayName: string;
  kind: StayKind;
  /** Só nas casas: o que a casa custa ao todo, em cêntimos inteiros. */
  totalCents: number | null;
  nights: number;
  commitment: StayCommitment | null;
  /** Lugares que a casa tem para além de quem a propôs. */
  sparePlaces: number | null;
  /** Quantos já foram aceites. */
  taken: number;
  /** O que cada um paga com a gente que já entrou, e com a casa cheia. */
  shareNowCents: number | null;
  shareFullCents: number | null;
  /** O anúncio que a pessoa viu, e o dia em que o viu. Pode já não estar disponível: quem abre, confirma. */
  listingUrl: string | null;
  listingSeenOn: string | null;
  status: 'a_juntar' | 'reservada';
  note: string | null;
  updatedOn: string;
  isMine: boolean;
  /** O teu lugar nesta casa, se pediste. */
  myStatus: StayPlaceStatus | null;
  /** Pedidos à espera de resposta (só a quem propôs a casa). */
  pending: number;
};

export type StayPlacePerson = {
  profileId: string;
  displayName: string;
  status: StayPlaceStatus;
  isMine: boolean;
};

function toKind(value: string | null): StayKind {
  return value === 'tem_casa' ? 'tem_casa' : 'procura';
}

function toCommitment(value: string | null): StayCommitment | null {
  return value === 'certo' || value === 'se_houver' ? value : null;
}

function toPlaceStatus(value: string | null): StayPlaceStatus | null {
  return value === 'pedido' || value === 'aceite' || value === 'recusado' || value === 'saiu'
    ? value
    : null;
}

/** Casas propostas para este jogo e quem precisa de cama. As casas primeiro, as reservadas no fim. */
export async function fetchStayPlans(fixtureId: string): Promise<StayPlan[]> {
  const { data, error } = await client().rpc('fixture_stay_plans', { p_fixture_id: fixtureId });
  if (error) throw error;
  // O servidor devolve colunas anuláveis; uma linha sem o essencial não se mostra a ninguém.
  return data.flatMap((row) =>
    row.nights === null
      ? []
      : [
          {
            id: row.id,
            displayName: row.display_name ?? 'Um adepto',
            kind: toKind(row.kind),
            totalCents: row.total_cents,
            nights: row.nights,
            commitment: toCommitment(row.commitment),
            sparePlaces: row.spare_places,
            taken: row.taken ?? 0,
            shareNowCents: row.share_now_cents,
            shareFullCents: row.share_full_cents,
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

export type NewStayPlan = {
  kind: StayKind;
  nights: number;
  /** Casas: o custo total, os lugares e a convicção de quem propõe. */
  totalCents: number | null;
  sparePlaces: number | null;
  commitment: StayCommitment | null;
  listingUrl: string | null;
  note: string;
};

/** Propõe uma casa, ou diz que precisas de cama. Um por pessoa e por jogo; repetir corrige. */
export async function setStayPlan(fixtureId: string, plan: NewStayPlan) {
  const { error } = await client().rpc('set_stay_plan', {
    p_fixture_id: fixtureId,
    p_kind: plan.kind,
    p_nights: plan.nights,
    p_total_cents: plan.totalCents ?? undefined,
    p_spare_places: plan.sparePlaces ?? undefined,
    p_commitment: plan.commitment ?? undefined,
    p_note: plan.note.trim(),
    p_listing_url: plan.listingUrl?.trim() || undefined,
  });
  if (error) throw refusal(error);
}

/** Desisti: sai da lista. */
export async function removeStayPlan(fixtureId: string) {
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

/** Quem pediu lugar numa casa: quem a propôs vê toda a gente, quem pediu vê-se a si próprio. */
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
            status,
            isMine: row.is_mine === true,
          },
        ]
      : [];
  });
}
