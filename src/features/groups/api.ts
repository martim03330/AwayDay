import { base64ParaBytes, lerFicheiroEmBase64 } from '@/lib/ficheiros';
import { supabase } from '@/lib/supabase';

// Grupos: a malta que anda junta de jogo para jogo. Entra-se por convite (um link com um código) e não há pedidos
// nem aprovações — quem tem o link entra. Lá dentro, o grupo é uma conversa (separador «Malta»), com uma foto e um
// fundo escolhidos pelo grupo.

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
  | 'bad_message'
  | 'bad_path'
  | 'bad_background'
  | 'place_not_found'
  | 'not_yours'
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
  'bad_message',
  'bad_path',
  'bad_background',
  'place_not_found',
  'not_yours',
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
  /** Despesas já lançadas nas contas desta viagem. */
  expenses: number;
  totalCents: number;
};

/** As viagens do grupo: os jogos em que o grupo tem boleia, casa ou contas. */
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
            expenses: row.expenses ?? 0,
            totalCents: row.total_cents ?? 0,
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

/** As fotos dos grupos vivem num balde privado, numa pasta por grupo: só quem é do grupo as abre. */
const BALDE_GRUPOS = 'group-photos';
const SEGUNDOS_DO_LINK = 60 * 60;

async function linksDasFotos(caminhos: (string | null)[]): Promise<Record<string, string>> {
  const validos = [...new Set(caminhos.filter((caminho): caminho is string => Boolean(caminho)))];
  if (validos.length === 0) return {};
  const assinados = await client()
    .storage.from(BALDE_GRUPOS)
    .createSignedUrls(validos, SEGUNDOS_DO_LINK);
  if (assinados.error) throw assinados.error;
  return Object.fromEntries(
    assinados.data.flatMap((item) => (item.signedUrl ? [[item.path ?? '', item.signedUrl]] : []))
  );
}

/** Os fundos da conversa que vêm com a app. 'foto' é uma foto escolhida pelo grupo. */
export const FUNDOS = ['relvado', 'bancada', 'noite', 'cachecol', 'liso'] as const;
export type FundoPronto = (typeof FUNDOS)[number];
export type FundoConversa =
  { kind: 'pronto'; fundo: FundoPronto } | { kind: 'foto'; url: string | null };

function paraFundo(valor: string | null, url: string | null): FundoConversa {
  if (valor === 'foto') return { kind: 'foto', url };
  const pronto = FUNDOS.find((fundo) => fundo === valor);
  return { kind: 'pronto', fundo: pronto ?? 'relvado' };
}

/**
 * 'texto': uma mensagem escrita. 'local': «estou aqui», num tasco — o corpo é «no Tasco do Zé». 'plano': o convite
 * para um jogo — o corpo é «Benfica x Porto».
 */
export type MessageKind = 'texto' | 'local' | 'plano';

function toKind(valor: string | null): MessageKind {
  return valor === 'local' || valor === 'plano' ? valor : 'texto';
}

/** Um grupo na lista da Malta. */
export type GroupInboxItem = {
  id: string;
  name: string;
  role: GroupRole;
  members: number;
  inviteCode: string;
  photoPath: string | null;
  photoUrl: string | null;
  fundo: FundoConversa;
  fundoPath: string | null;
  /** Mensagens de outros que ainda não leste. */
  unread: number;
  last: {
    kind: MessageKind;
    body: string;
    name: string;
    mine: boolean;
    at: string;
  } | null;
};

/** Os meus grupos, com a cara, o fundo e a última mensagem. Os que falaram há menos tempo vêm primeiro. */
export async function fetchMyGroupInbox(): Promise<GroupInboxItem[]> {
  const { data, error } = await client().rpc('my_group_inbox');
  if (error) throw error;
  const links = await linksDasFotos(
    data.flatMap((row) => [row.photo_path, row.chat_background_path])
  );
  return data.map((row) => ({
    id: row.group_id,
    name: row.name ?? 'Grupo',
    role: toRole(row.role),
    members: row.members ?? 1,
    inviteCode: row.invite_code ?? '',
    photoPath: row.photo_path,
    photoUrl: row.photo_path ? (links[row.photo_path] ?? null) : null,
    fundo: paraFundo(
      row.chat_background,
      row.chat_background_path ? (links[row.chat_background_path] ?? null) : null
    ),
    fundoPath: row.chat_background_path,
    unread: row.unread ?? 0,
    last:
      row.last_at && row.last_body
        ? {
            kind: toKind(row.last_kind),
            body: row.last_body,
            name: row.last_name ?? 'Um adepto',
            mine: row.last_mine === true,
            at: row.last_at,
          }
        : null,
  }));
}

/** Sobe uma foto para a pasta do grupo. Devolve o caminho, para guardar como cara ou como fundo. */
async function subirFoto(
  groupId: string,
  prefixo: string,
  input: { uri: string; mimeType: string }
) {
  const extensao =
    input.mimeType === 'image/png' ? 'png' : input.mimeType === 'image/heic' ? 'heic' : 'jpg';
  const caminho = `${groupId}/${prefixo}-${Date.now()}.${extensao}`;
  const bytes = base64ParaBytes(await lerFicheiroEmBase64(input.uri));
  const subida = await client()
    .storage.from(BALDE_GRUPOS)
    .upload(caminho, bytes, { contentType: input.mimeType, upsert: false });
  if (subida.error) throw subida.error;
  return caminho;
}

/** A foto antiga já não serve a ninguém. Se não der para a apagar, fica — não é motivo para falhar. */
async function apagarFoto(caminho: string | null) {
  if (!caminho) return;
  await client()
    .storage.from(BALDE_GRUPOS)
    .remove([caminho])
    .catch(() => undefined);
}

/** A cara do grupo. `null` tira a foto. */
export async function saveGroupPhoto(
  group: Pick<GroupInboxItem, 'id' | 'photoPath'>,
  input: { uri: string; mimeType: string } | null
) {
  const caminho = input ? await subirFoto(group.id, 'cara', input) : null;
  const { error } = await client().rpc('set_group_photo', {
    p_group_id: group.id,
    p_path: caminho ?? undefined,
  });
  if (error) {
    await apagarFoto(caminho);
    throw refusal(error);
  }
  if (group.photoPath !== caminho) await apagarFoto(group.photoPath);
}

/** O fundo da conversa: um dos da app, ou uma foto escolhida da galeria. */
export async function saveGroupBackground(
  group: Pick<GroupInboxItem, 'id' | 'fundoPath'>,
  escolha: { kind: 'pronto'; fundo: FundoPronto } | { kind: 'foto'; uri: string; mimeType: string }
) {
  const caminho = escolha.kind === 'foto' ? await subirFoto(group.id, 'fundo', escolha) : null;
  const { error } = await client().rpc('set_group_chat_background', {
    p_group_id: group.id,
    p_background: escolha.kind === 'foto' ? 'foto' : escolha.fundo,
    p_path: caminho ?? undefined,
  });
  if (error) {
    await apagarFoto(caminho);
    throw refusal(error);
  }
  if (group.fundoPath !== caminho) await apagarFoto(group.fundoPath);
}

export type GroupMessage = {
  id: string;
  profileId: string;
  displayName: string;
  kind: MessageKind;
  body: string;
  placeId: string | null;
  /** Só nos convites ('plano'): o plano do cartão. */
  planId: string | null;
  mine: boolean;
  /** Podes apagá-la: escreveste-a, ou criaste o grupo. */
  canRemove: boolean;
  createdAt: string;
};

/** As mensagens, da mais recente para a mais antiga (a conversa desenha-se de baixo para cima). */
export async function fetchGroupMessages(groupId: string): Promise<GroupMessage[]> {
  const { data, error } = await client().rpc('group_messages', {
    p_group_id: groupId,
    p_limit: 100,
  });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    displayName: row.display_name ?? 'Um adepto',
    kind: toKind(row.kind),
    body: row.body ?? '',
    placeId: row.place_id,
    planId: row.plan_id,
    mine: row.mine === true,
    canRemove: row.can_remove === true,
    createdAt: row.created_at ?? '',
  }));
}

export async function sendGroupMessage(groupId: string, body: string): Promise<string> {
  const { data, error } = await client().rpc('send_group_message', {
    p_group_id: groupId,
    p_body: body.trim(),
  });
  if (error) throw refusal(error);
  return data;
}

/** «Estou aqui»: diz ao grupo em que tasco estás. Vai só o nome do tasco, nunca a localização. */
export async function sharePlaceWithGroup(groupId: string, placeId: string): Promise<string> {
  const { data, error } = await client().rpc('share_place_with_group', {
    p_group_id: groupId,
    p_place_id: placeId,
  });
  if (error) throw refusal(error);
  return data;
}

export async function removeGroupMessage(messageId: string) {
  const { error } = await client().rpc('remove_group_message', { p_message_id: messageId });
  if (error) throw refusal(error);
}

export async function markGroupMessagesRead(groupId: string) {
  const { error } = await client().rpc('mark_group_messages_read', { p_group_id: groupId });
  if (error) throw refusal(error);
}
