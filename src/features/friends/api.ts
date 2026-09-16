import { supabase } from '@/lib/supabase';

// Amigos: gente com quem já foste a um jogo e com quem queres voltar a ir. Um pedido só vale quando o outro aceita,
// e só se pede a quem já se cruzou contigo — no mesmo grupo, no mesmo carro ou nas mesmas contas.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type FriendRefusal =
  | 'not_signed_in'
  | 'bad_request'
  | 'profile_not_found'
  | 'never_met'
  | 'not_yours'
  | 'not_member'
  | 'not_friends'
  | 'already_member'
  | 'not_driver'
  | 'ride_full'
  | 'ride_closed'
  | 'rate_limited'
  | 'unknown';

export class FriendRefused extends Error {
  readonly reason: FriendRefusal;

  constructor(reason: FriendRefusal) {
    super(reason);
    this.name = 'FriendRefused';
    this.reason = reason;
  }
}

const RECUSAS: FriendRefusal[] = [
  'not_signed_in',
  'bad_request',
  'profile_not_found',
  'never_met',
  'not_yours',
  'not_member',
  'not_friends',
  'already_member',
  'not_driver',
  'ride_full',
  'ride_closed',
  'rate_limited',
];

function refusal(error: { message: string }) {
  return new FriendRefused(RECUSAS.find((reason) => error.message === reason) ?? 'unknown');
}

/** Em que pé estás com alguém. */
export type EstadoAmizade =
  | 'amigos'
  | 'pedido_enviado'
  | 'pedido_recebido'
  /** Já se cruzaram: dá para pedir. */
  | 'pode_pedir'
  /** Nunca se cruzaram: não dá para pedir, e é de propósito. */
  | 'nada';

export function estadoAmizade(valor: string | null): EstadoAmizade {
  switch (valor) {
    case 'amigos':
    case 'pedido_enviado':
    case 'pedido_recebido':
    case 'pode_pedir':
      return valor;
    default:
      return 'nada';
  }
}

export type Friend = {
  profileId: string;
  displayName: string;
  friendsSince: string | null;
  /** Jogos em que foram no mesmo carro ou dividiram as mesmas contas. */
  tripsTogether: number;
};

export type FriendRequest = {
  profileId: string;
  displayName: string;
  direction: 'recebido' | 'enviado';
  askedAt: string;
  tripsTogether: number;
};

export async function fetchMyFriends(): Promise<Friend[]> {
  const { data, error } = await client().rpc('my_friends');
  if (error) throw error;
  return data.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name ?? 'Um adepto',
    friendsSince: row.friends_since,
    tripsTogether: row.trips_together ?? 0,
  }));
}

export async function fetchMyFriendRequests(): Promise<FriendRequest[]> {
  const { data, error } = await client().rpc('my_friend_requests');
  if (error) throw error;
  return data.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name ?? 'Um adepto',
    direction: row.direction === 'enviado' ? ('enviado' as const) : ('recebido' as const),
    askedAt: row.asked_at ?? '',
    tripsTogether: row.trips_together ?? 0,
  }));
}

export async function fetchFriendshipStates(
  profileIds: string[]
): Promise<Record<string, EstadoAmizade>> {
  if (profileIds.length === 0) return {};
  const { data, error } = await client().rpc('friendship_states', { p_profile_ids: profileIds });
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.profile_id, estadoAmizade(row.state)]));
}

/** Pede amizade. Se essa pessoa já te tinha pedido, ficam amigos na hora. */
export async function sendFriendRequest(profileId: string): Promise<'pedido' | 'amigos'> {
  const { data, error } = await client().rpc('send_friend_request', { p_profile_id: profileId });
  if (error) throw refusal(error);
  return data === 'amigos' ? 'amigos' : 'pedido';
}

export async function acceptFriendRequest(profileId: string) {
  const { error } = await client().rpc('accept_friend_request', { p_profile_id: profileId });
  if (error) throw refusal(error);
}

/** Serve para recusar um pedido, desistir de um que mandaste, e deixar de ser amigo. */
export async function removeFriend(profileId: string) {
  const { error } = await client().rpc('remove_friend', { p_profile_id: profileId });
  if (error) throw refusal(error);
}

/** Quem foi contigo a este jogo, e em que pé estás com cada um. */
export type TripCompanion = {
  profileId: string;
  displayName: string;
  state: EstadoAmizade;
  tripsTogether: number;
};

export async function fetchTripCompanions(fixtureId: string): Promise<TripCompanion[]> {
  const { data, error } = await client().rpc('trip_companions', { p_fixture_id: fixtureId });
  if (error) throw error;
  return data.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name ?? 'Um adepto',
    state: estadoAmizade(row.state),
    tripsTogether: row.trips_together ?? 0,
  }));
}

export type GroupInvite = {
  groupId: string;
  groupName: string;
  members: number;
  invitedByName: string | null;
  invitedAt: string;
};

export async function fetchMyGroupInvites(): Promise<GroupInvite[]> {
  const { data, error } = await client().rpc('my_group_invites');
  if (error) throw error;
  return data.map((row) => ({
    groupId: row.group_id,
    groupName: row.group_name ?? 'Grupo',
    members: row.members ?? 1,
    invitedByName: row.invited_by_name,
    invitedAt: row.invited_at ?? '',
  }));
}

export async function inviteFriendToGroup(groupId: string, profileId: string) {
  const { error } = await client().rpc('invite_friend_to_group', {
    p_group_id: groupId,
    p_profile_id: profileId,
  });
  if (error) throw refusal(error);
}

export async function acceptGroupInvite(groupId: string) {
  const { error } = await client().rpc('accept_group_invite', { p_group_id: groupId });
  if (error) throw refusal(error);
}

export async function declineGroupInvite(groupId: string) {
  const { error } = await client().rpc('decline_group_invite', { p_group_id: groupId });
  if (error) throw refusal(error);
}

export type RideInvite = {
  rideId: string;
  fixtureId: string;
  kickoffAt: string;
  departureAt: string;
  originName: string;
  driverName: string;
  seatsLeft: number;
  /** O que te calharia, contando contigo. */
  shareCents: number;
  invitedAt: string;
};

export async function fetchMyRideInvites(): Promise<RideInvite[]> {
  const { data, error } = await client().rpc('my_ride_invites');
  if (error) throw error;
  return data.flatMap((row) =>
    row.ride_id && row.fixture_id && row.departure_at
      ? [
          {
            rideId: row.ride_id,
            fixtureId: row.fixture_id,
            kickoffAt: row.kickoff_at ?? '',
            departureAt: row.departure_at,
            originName: row.origin_name ?? '',
            driverName: row.driver_name ?? 'Um adepto',
            seatsLeft: row.seats_left ?? 0,
            shareCents: row.share_cents ?? 0,
            invitedAt: row.invited_at ?? '',
          },
        ]
      : []
  );
}

export async function inviteFriendToRide(rideId: string, profileId: string) {
  const { error } = await client().rpc('invite_friend_to_ride', {
    p_ride_id: rideId,
    p_profile_id: profileId,
  });
  if (error) throw refusal(error);
}

export async function acceptRideInvite(rideId: string) {
  const { error } = await client().rpc('accept_ride_invite', { p_ride_id: rideId });
  if (error) throw refusal(error);
}

export async function declineRideInvite(rideId: string) {
  const { error } = await client().rpc('decline_ride_invite', { p_ride_id: rideId });
  if (error) throw refusal(error);
}
