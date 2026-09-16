import { supabase } from '@/lib/supabase';

// Grupos: a malta que anda junta de jogo para jogo. Entra-se por convite (um link com um código) e não há pedidos
// nem aprovações — quem tem o link entra. Nenhum grupo nasce sozinho: as boleias e as casas é que se ligam a um
// grupo, e é assim que o grupo ganha o histórico das viagens.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type GroupRefusal =
  | 'not_signed_in'
  | 'bad_name'
  | 'group_not_found'
  | 'not_member'
  | 'not_owner'
  | 'own_membership'
  | 'rate_limited'
  | 'unknown';

export class GroupRefused extends Error {
  readonly reason: GroupRefusal;

  constructor(reason: GroupRefusal) {
    super(reason);
    this.name = 'GroupRefused';
    this.reason = reason;
  }
}

const RECUSAS: GroupRefusal[] = [
  'not_signed_in',
  'bad_name',
  'group_not_found',
  'not_member',
  'not_owner',
  'own_membership',
  'rate_limited',
];

function refusal(error: { message: string }) {
  return new GroupRefused(RECUSAS.find((reason) => error.message === reason) ?? 'unknown');
}

export type GroupRole = 'owner' | 'member';

export type FanGroup = {
  id: string;
  name: string;
  role: GroupRole;
  members: number;
  /** 'boleia': nasceu de uma boleia; 'manual': alguém o criou. */
  source: 'manual' | 'boleia';
  inviteCode: string;
  createdOn: string;
};

export type GroupMember = {
  profileId: string;
  displayName: string;
  role: GroupRole;
  /** O mesmo que se mostra nas casas: desde quando tem conta, boleias feitas e faltas. */
  memberSince: string;
  ridesCompleted: number;
  ridesFaults: number;
  isMine: boolean;
};

function toRole(value: string | null): GroupRole {
  return value === 'owner' ? 'owner' : 'member';
}

/** Os grupos em que estás, com quanta gente têm. */
export async function fetchMyGroups(): Promise<FanGroup[]> {
  const { data, error } = await client().rpc('my_groups');
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    name: row.name ?? 'Grupo',
    role: toRole(row.role),
    members: row.members ?? 1,
    source: row.source === 'boleia' ? 'boleia' : 'manual',
    inviteCode: row.invite_code ?? '',
    createdOn: row.created_on ?? '',
  }));
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await client().rpc('group_members', { p_group_id: groupId });
  if (error) throw error;
  return data.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name ?? 'Um adepto',
    role: toRole(row.role),
    memberSince: row.member_since ?? '',
    ridesCompleted: row.rides_completed ?? 0,
    ridesFaults: row.rides_faults ?? 0,
    isMine: row.is_mine === true,
  }));
}

export async function createGroup(name: string): Promise<string> {
  const { data, error } = await client().rpc('create_group', { p_name: name.trim() });
  if (error) throw refusal(error);
  return data;
}

/** O que está por trás de um convite, antes de entrar. */
export async function fetchGroupByCode(code: string) {
  const { data, error } = await client().rpc('group_by_code', { p_code: code.trim() });
  if (error) throw error;
  const row = data[0];
  return row
    ? {
        id: row.id,
        name: row.name ?? 'Grupo',
        members: row.members ?? 1,
        alreadyIn: row.already_in === true,
      }
    : null;
}

export async function joinGroupWithCode(code: string): Promise<string> {
  const { data, error } = await client().rpc('join_group_with_code', { p_code: code.trim() });
  if (error) throw refusal(error);
  return data;
}

export async function leaveGroup(groupId: string) {
  const { error } = await client().rpc('leave_group', { p_group_id: groupId });
  if (error) throw refusal(error);
}

export async function renameGroup(groupId: string, name: string) {
  const { error } = await client().rpc('rename_group', {
    p_group_id: groupId,
    p_name: name.trim(),
  });
  if (error) throw refusal(error);
}

/** Troca o código do convite: o link antigo deixa de servir. */
export async function rotateGroupInvite(groupId: string): Promise<string> {
  const { data, error } = await client().rpc('rotate_group_invite', { p_group_id: groupId });
  if (error) throw refusal(error);
  return data;
}

export async function removeGroupMember(groupId: string, profileId: string) {
  const { error } = await client().rpc('remove_group_member', {
    p_group_id: groupId,
    p_profile_id: profileId,
  });
  if (error) throw refusal(error);
}

export type GroupTrip = {
  fixtureId: string;
  kickoffAt: string;
  rides: number;
  houses: number;
  seatsTaken: number;
};

/** As viagens do grupo: os jogos em que o grupo tem boleia ou casa. */
export async function fetchGroupTrips(groupId: string): Promise<GroupTrip[]> {
  const { data, error } = await client().rpc('group_trips', { p_group_id: groupId });
  if (error) throw error;
  return data.flatMap((row) =>
    row.fixture_id && row.kickoff_at
      ? [
          {
            fixtureId: row.fixture_id,
            kickoffAt: row.kickoff_at,
            rides: row.rides ?? 0,
            houses: row.houses ?? 0,
            seatsTaken: row.seats_taken ?? 0,
          },
        ]
      : []
  );
}

/** Uma boleia ou uma casa que o grupo tem em mãos para um jogo. */
export type GroupPlan = {
  kind: 'boleia' | 'casa';
  id: string;
  fixtureId: string;
  kickoffAt: string;
  ownerName: string;
  isMine: boolean;
  /** Só nas boleias. */
  departureAt: string | null;
  /** Lugares no carro, ou camas na casa, para além de quem a ofereceu. */
  seatsTotal: number;
  taken: number;
  shareNowCents: number;
  visibility: 'grupo' | 'publica';
  /** 'open'/'cancelled' nas boleias; 'a_juntar'/'reservada' nas casas. */
  status: string;
  /** O teu lugar, se pediste. */
  myStatus: string | null;
};

/** O que o grupo tem para encher: boleias e casas do grupo, do jogo mais próximo para a frente. */
export async function fetchGroupPlans(groupId: string): Promise<GroupPlan[]> {
  const { data, error } = await client().rpc('group_plans', { p_group_id: groupId });
  if (error) throw error;
  return data.flatMap((row) =>
    row.id && row.fixture_id && row.kickoff_at
      ? [
          {
            kind: row.kind === 'casa' ? ('casa' as const) : ('boleia' as const),
            id: row.id,
            fixtureId: row.fixture_id,
            kickoffAt: row.kickoff_at,
            ownerName: row.owner_name ?? 'Um adepto',
            isMine: row.is_mine === true,
            departureAt: row.departure_at,
            seatsTotal: row.seats_total ?? 0,
            taken: row.taken ?? 0,
            shareNowCents: row.share_now_cents ?? 0,
            visibility: row.visibility === 'grupo' ? ('grupo' as const) : ('publica' as const),
            status: row.status ?? '',
            myStatus: row.my_status,
          },
        ]
      : []
  );
}
