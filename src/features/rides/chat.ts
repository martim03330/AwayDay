import { supabase } from '@/lib/supabase';

// A conversa do carro: o condutor e quem já foi aceite. Quem só pediu lugar não entra — o pedido já leva um recado
// escrito, e um condutor com o carro cheio não precisa de mensagens de dez desconhecidos.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type ChatRefusal =
  | 'not_signed_in'
  | 'not_in_ride'
  | 'bad_message'
  | 'chat_closed'
  | 'not_yours'
  | 'rate_limited'
  | 'unknown';

export class ChatRefused extends Error {
  readonly reason: ChatRefusal;

  constructor(reason: ChatRefusal) {
    super(reason);
    this.name = 'ChatRefused';
    this.reason = reason;
  }
}

const RECUSAS: ChatRefusal[] = [
  'not_signed_in',
  'not_in_ride',
  'bad_message',
  'chat_closed',
  'not_yours',
  'rate_limited',
];

function refusal(error: { message: string }) {
  return new ChatRefused(RECUSAS.find((reason) => error.message === reason) ?? 'unknown');
}

export type RideMessage = {
  id: string;
  profileId: string;
  displayName: string;
  body: string;
  mine: boolean;
  /** Podes apagá-la: escreveste-a, ou és o condutor. */
  canRemove: boolean;
  createdAt: string;
};

/** As mensagens, da mais antiga para a mais recente — como se lê uma conversa. */
export async function fetchRideMessages(rideId: string): Promise<RideMessage[]> {
  const { data, error } = await client().rpc('ride_messages', { p_ride_id: rideId });
  if (error) throw error;
  return data
    .map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      displayName: row.display_name ?? 'Um adepto',
      body: row.body ?? '',
      mine: row.mine === true,
      canRemove: row.can_remove === true,
      createdAt: row.created_at ?? '',
    }))
    .reverse();
}

export async function sendRideMessage(rideId: string, body: string): Promise<string> {
  const { data, error } = await client().rpc('send_ride_message', {
    p_ride_id: rideId,
    p_body: body.trim(),
  });
  if (error) throw refusal(error);
  return data;
}

export async function removeRideMessage(messageId: string) {
  const { error } = await client().rpc('remove_ride_message', { p_message_id: messageId });
  if (error) throw refusal(error);
}

export async function markRideMessagesRead(rideId: string) {
  const { error } = await client().rpc('mark_ride_messages_read', { p_ride_id: rideId });
  if (error) throw refusal(error);
}

export type RideChat = {
  rideId: string;
  fixtureId: string;
  /** Mensagens de outros que ainda não leste. */
  unread: number;
  lastBody: string | null;
  lastName: string | null;
  lastAt: string | null;
  /** Ainda dá para escrever (fecha um dia depois do jogo). */
  open: boolean;
};

export async function fetchMyRideChats(): Promise<RideChat[]> {
  const { data, error } = await client().rpc('my_ride_chats');
  if (error) throw error;
  return data.flatMap((row) =>
    row.ride_id && row.fixture_id
      ? [
          {
            rideId: row.ride_id,
            fixtureId: row.fixture_id,
            unread: row.unread ?? 0,
            lastBody: row.last_body,
            lastName: row.last_name,
            lastAt: row.last_at,
            open: row.open === true,
          },
        ]
      : []
  );
}
