import { supabase } from '@/lib/supabase';

// Os planos: alguém convida o grupo para um jogo, a malta responde «vou» ou «estou a pensar», e quem convidou
// combina a boleia e a dormida até o plano fechar — sozinho, quando o carro enche, ou à mão.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type PlanRefusal =
  | 'not_signed_in'
  | 'not_member'
  | 'not_owner'
  | 'fixture_not_found'
  | 'fixture_over'
  | 'plan_not_found'
  | 'plan_closed'
  | 'same_group'
  | 'ride_not_found'
  | 'stay_not_found'
  | 'stay_not_locked'
  | 'own_ride'
  | 'ride_full'
  | 'ride_closed'
  | 'own_house'
  | 'house_full'
  | 'already_going'
  | 'driver_not_in_plan'
  | 'already_offering'
  | 'owner_not_in_plan'
  | 'needs_history'
  /** The group already has an invite for this game: `planId` says which. */
  | 'plan_exists'
  /** Taking a plan back from a group it was never sent to. */
  | 'not_shared'
  | 'rate_limited'
  | 'unknown';

export class PlanRefused extends Error {
  readonly reason: PlanRefusal;
  /** For 'plan_exists': the plan the group already has. */
  readonly planId: string | null;

  constructor(reason: PlanRefusal, planId: string | null = null) {
    super(reason);
    this.name = 'PlanRefused';
    this.reason = reason;
    this.planId = planId;
  }
}

const RECUSAS: PlanRefusal[] = [
  'not_signed_in',
  'not_member',
  'not_owner',
  'fixture_not_found',
  'fixture_over',
  'plan_not_found',
  'plan_closed',
  'same_group',
  'ride_not_found',
  'stay_not_found',
  'stay_not_locked',
  'own_ride',
  'ride_full',
  'ride_closed',
  'own_house',
  'house_full',
  'already_going',
  'driver_not_in_plan',
  'already_offering',
  'owner_not_in_plan',
  'needs_history',
  'plan_exists',
  'not_shared',
  'rate_limited',
];

function refusal(error: { message: string; details?: string | null }) {
  const reason = RECUSAS.find((candidate) => error.message === candidate) ?? 'unknown';
  const planId = reason === 'plan_exists' && error.details ? error.details : null;
  return new PlanRefused(reason, planId);
}

export type PlanAnswer = 'vou' | 'talvez';
export type PlanStatus = 'aberto' | 'fechado';

export type FixturePlan = {
  id: string;
  /** O grupo onde o plano nasceu. */
  groupId: string;
  groupName: string;
  fixtureId: string;
  kickoffAt: string;
  createdBy: string;
  creatorName: string;
  /** Foste tu que convidaste: és tu que combinas e fechas. */
  isMine: boolean;
  status: PlanStatus;
  /** Fechou sozinho porque o carro encheu. */
  closedByFullCar: boolean;
  going: number;
  maybe: number;
  myAnswer: PlanAnswer | null;
  /** A quantos outros grupos foi mandado. */
  sharedGroups: number;
  ride: {
    id: string;
    driverId: string;
    driverName: string;
    departureAt: string;
    seatsOffered: number;
    seatsTaken: number;
    shareNowCents: number;
    publica: boolean;
    roundTrip: boolean;
    acceptsReturn: boolean;
    /** 'driver', ou o estado do teu pedido de lugar. */
    myStatus: string | null;
  } | null;
  stay: {
    id: string;
    ownerId: string;
    ownerName: string;
    spare: number;
    taken: number;
    booked: boolean;
    publica: boolean;
  } | null;
};

type SummaryRow = {
  id: string;
  group_id: string;
  group_name: string;
  fixture_id: string;
  kickoff_at: string;
  created_by: string;
  creator_name: string;
  is_mine: boolean;
  status: string;
  closed_reason: string | null;
  going: number;
  maybe: number;
  my_answer: string | null;
  shared_groups: number;
  ride_id: string | null;
  ride_driver_id: string | null;
  ride_driver_name: string | null;
  ride_departure_at: string | null;
  ride_seats_offered: number | null;
  ride_seats_taken: number | null;
  ride_share_now_cents: number | null;
  ride_visibility: string | null;
  ride_round_trip: boolean | null;
  ride_accepts_return: boolean | null;
  ride_my_status: string | null;
  stay_id: string | null;
  stay_owner_id: string | null;
  stay_owner_name: string | null;
  stay_spare: number | null;
  stay_taken: number | null;
  stay_status: string | null;
  stay_visibility: string | null;
};

function toPlan(row: SummaryRow): FixturePlan {
  return {
    id: row.id,
    groupId: row.group_id,
    groupName: row.group_name ?? 'Grupo',
    fixtureId: row.fixture_id,
    kickoffAt: row.kickoff_at,
    createdBy: row.created_by,
    creatorName: row.creator_name ?? 'Um adepto',
    isMine: row.is_mine === true,
    status: row.status === 'fechado' ? 'fechado' : 'aberto',
    closedByFullCar: row.closed_reason === 'carro_cheio',
    going: row.going ?? 0,
    maybe: row.maybe ?? 0,
    myAnswer: row.my_answer === 'vou' || row.my_answer === 'talvez' ? row.my_answer : null,
    sharedGroups: row.shared_groups ?? 0,
    ride:
      row.ride_id && row.ride_driver_id && row.ride_departure_at
        ? {
            id: row.ride_id,
            driverId: row.ride_driver_id,
            driverName: row.ride_driver_name ?? 'Um adepto',
            departureAt: row.ride_departure_at,
            seatsOffered: row.ride_seats_offered ?? 0,
            seatsTaken: row.ride_seats_taken ?? 0,
            shareNowCents: row.ride_share_now_cents ?? 0,
            publica: row.ride_visibility === 'publica',
            roundTrip: row.ride_round_trip === true,
            acceptsReturn: row.ride_accepts_return === true,
            myStatus: row.ride_my_status,
          }
        : null,
    stay:
      row.stay_id && row.stay_owner_id
        ? {
            id: row.stay_id,
            ownerId: row.stay_owner_id,
            ownerName: row.stay_owner_name ?? 'Um adepto',
            spare: row.stay_spare ?? 0,
            taken: row.stay_taken ?? 0,
            booked: row.stay_status === 'reservada',
            publica: row.stay_visibility === 'publica',
          }
        : null,
  };
}

/** Os planos pedidos (por exemplo, os dos cartões de uma conversa). Os que não podes ver ficam de fora. */
export async function fetchPlans(planIds: string[]): Promise<FixturePlan[]> {
  if (planIds.length === 0) return [];
  const { data, error } = await client().rpc('fixture_plan_summaries', { p_plan_ids: planIds });
  if (error) throw error;
  return data.map(toPlan);
}

/** Os planos de um grupo (os abertos, e os fechados cujo jogo ainda não passou), do jogo mais próximo para a frente. */
export async function fetchGroupFixturePlans(groupId: string): Promise<FixturePlan[]> {
  const { data, error } = await client().rpc('group_fixture_plans', { p_group_id: groupId });
  if (error) throw error;
  const ids = data.filter((id): id is string => typeof id === 'string');
  const planos = await fetchPlans(ids);
  return ids.flatMap((id) => planos.filter((plano) => plano.id === id));
}

export type PlanPerson = {
  profileId: string;
  displayName: string;
  answer: PlanAnswer;
  isMe: boolean;
  /** Já vai a este jogo com outro grupo (plano fechado lá). */
  otherGroup: string | null;
};

export async function fetchPlanPeople(planId: string): Promise<PlanPerson[]> {
  const { data, error } = await client().rpc('fixture_plan_people', { p_plan_id: planId });
  if (error) throw error;
  return data.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name ?? 'Um adepto',
    answer: row.answer === 'talvez' ? ('talvez' as const) : ('vou' as const),
    isMe: row.is_me === true,
    otherGroup: row.other_group,
  }));
}

/** Para cada plano, o grupo com que já vou a esse jogo noutro plano fechado (só os que têm conflito). */
export async function fetchMyPlanConflicts(planIds: string[]): Promise<Record<string, string>> {
  if (planIds.length === 0) return {};
  const { data, error } = await client().rpc('my_plan_conflicts', { p_plan_ids: planIds });
  if (error) throw error;
  return Object.fromEntries(
    data.flatMap((row) => (row.plan_id && row.other_group ? [[row.plan_id, row.other_group]] : []))
  );
}

/**
 * Convidar o grupo para um jogo: o cartão cai na conversa. Se o grupo já tem convite para esse jogo, é recusado com
 * 'plan_exists' e o `planId` desse convite.
 */
export async function inviteGroupToFixture(groupId: string, fixtureId: string): Promise<string> {
  const { data, error } = await client().rpc('invite_group_to_fixture', {
    p_group_id: groupId,
    p_fixture_id: fixtureId,
  });
  if (error) throw refusal(error);
  return data;
}

/** Mandar o plano a outro grupo teu. */
export async function sharePlan(planId: string, groupId: string) {
  const { error } = await client().rpc('share_fixture_plan', {
    p_plan_id: planId,
    p_group_id: groupId,
  });
  if (error) throw refusal(error);
}

/** Deixar de abrir o plano a um grupo a quem foi mandado. Os lugares já aceites ficam; os dois grupos são avisados. */
export async function unsharePlan(planId: string, groupId: string) {
  const { error } = await client().rpc('unshare_fixture_plan', {
    p_plan_id: planId,
    p_group_id: groupId,
  });
  if (error) throw refusal(error);
}

/** Um grupo a quem o plano foi mandado. */
export type SharedGroup = { groupId: string; groupName: string };

/** A que grupos o plano foi mandado. Só responde a quem é do grupo de origem; para os outros vem vazio. */
export async function fetchPlanSharedGroups(planId: string): Promise<SharedGroup[]> {
  const { data, error } = await client().rpc('fixture_plan_shared_groups', { p_plan_id: planId });
  if (error) throw error;
  return data.map((row) => ({ groupId: row.group_id, groupName: row.group_name ?? 'Grupo' }));
}

/** «Vou», «Estou a pensar», ou `null` para tirar a resposta. */
export async function answerPlan(planId: string, answer: PlanAnswer | null) {
  const { error } = await client().rpc('answer_fixture_plan', {
    p_plan_id: planId,
    p_answer: answer ?? undefined,
  });
  if (error) throw refusal(error);
}

export async function setPlanRide(planId: string, rideId: string | null) {
  const { error } = await client().rpc('set_fixture_plan_ride', {
    p_plan_id: planId,
    p_ride_id: rideId ?? undefined,
  });
  if (error) throw refusal(error);
}

export async function setPlanStay(planId: string, stayPlanId: string | null) {
  const { error } = await client().rpc('set_fixture_plan_stay', {
    p_plan_id: planId,
    p_stay_plan_id: stayPlanId ?? undefined,
  });
  if (error) throw refusal(error);
}

/** Fechar (mesmo com lugares por encher), voltar a abrir, ou desistir do plano. Só quem convidou. */
export async function setPlanStatus(planId: string, status: 'aberto' | 'fechado' | 'cancelado') {
  const { error } = await client().rpc('set_fixture_plan_status', {
    p_plan_id: planId,
    p_status: status,
  });
  if (error) throw refusal(error);
}

/** Uma casa proposta para o plano, com as preferências da malta. */
export type PlanHouse = {
  id: string;
  ownerId: string;
  ownerName: string;
  /** O que a casa custa ao todo, em cêntimos inteiros. */
  totalCents: number;
  nights: number;
  /** Camas para além de quem a propôs. */
  sparePlaces: number;
  taken: number;
  /** O que cada um paga com quem já entrou, e com a casa cheia (contas do servidor). */
  shareNowCents: number;
  shareFullCents: number;
  listingUrl: string | null;
  booked: boolean;
  note: string | null;
  isMine: boolean;
  /** O teu lugar nesta casa, se pediste. */
  myStatus: string | null;
  votes: number;
  myVote: boolean;
  /** É a casa do plano. */
  chosen: boolean;
  /** A escolha está fechada: a malta entra direto na casa do plano. */
  locked: boolean;
  /** Quem já está na casa, a começar por quem a propôs. */
  peopleNames: string[];
};

/** As casas do plano: a escolhida primeiro, depois as mais preferidas. */
export async function fetchPlanHouses(planId: string): Promise<PlanHouse[]> {
  const { data, error } = await client().rpc('fixture_plan_houses', { p_plan_id: planId });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name ?? 'Um adepto',
    totalCents: row.total_cents ?? 0,
    nights: row.nights ?? 1,
    sparePlaces: row.spare_places ?? 0,
    taken: row.taken ?? 0,
    shareNowCents: row.share_now_cents ?? 0,
    shareFullCents: row.share_full_cents ?? 0,
    listingUrl: row.listing_url,
    booked: row.status === 'reservada',
    note: row.note,
    isMine: row.is_mine === true,
    myStatus: row.my_status,
    votes: row.votes ?? 0,
    myVote: row.my_vote === true,
    chosen: row.chosen === true,
    locked: row.locked === true,
    peopleNames: row.people_names ?? [],
  }));
}

/** «Prefiro esta» (uma por pessoa e por plano). `null` tira a preferência. */
export async function voteForPlanHouse(planId: string, stayPlanId: string | null) {
  const { error } = await client().rpc('vote_fixture_plan_house', {
    p_plan_id: planId,
    p_stay_plan_id: stayPlanId ?? undefined,
  });
  if (error) throw refusal(error);
}

/** Dentro do grupo não se pede lugar: entra-se no carro do plano, se houver lugar. */
export async function joinPlanRide(planId: string) {
  const { error } = await client().rpc('join_plan_ride', { p_plan_id: planId });
  if (error) throw refusal(error);
}

/** Com a escolha da casa fechada, entra-se direto na casa do plano. */
export async function joinPlanStay(planId: string) {
  const { error } = await client().rpc('join_plan_stay', { p_plan_id: planId });
  if (error) throw refusal(error);
}

/** Fechar a escolha da casa (fica a casa do plano), ou voltar a abri-la. Só quem convidou. */
export async function setPlanStayLocked(planId: string, locked: boolean) {
  const { error } = await client().rpc('set_plan_stay_locked', {
    p_plan_id: planId,
    p_locked: locked,
  });
  if (error) throw refusal(error);
}
