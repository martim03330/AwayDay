import { lerCitacao, lerReacoes, type Citacao, type Emoji, type Reacao } from '@/lib/conversa';
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
  editedAt: string | null;
  /** A mensagem a que esta responde. */
  replyTo: Citacao | null;
  reactions: Reacao[];
  /** Menciona-te: pelo nome, ou com @todos. */
  mentionsMe: boolean;
  /**
   * Só nas que enviaste daqui: a chave com que apareceram antes de o servidor confirmar. Fica igual quando o id muda,
   * para a bolha não ser desenhada outra vez (e a animação de envio não ser cortada).
   */
  chaveLocal?: string;
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
      editedAt: row.edited_at,
      replyTo: lerCitacao(row.reply_to_id, row.reply_display_name, row.reply_body),
      reactions: lerReacoes(row.reactions),
    mentionsMe: row.mentions_me === true,
    }))
    .reverse();
}

export async function sendRideMessage(
  rideId: string,
  body: string,
  replyTo: string | null = null,
  mentions: { ids: string[]; todos: boolean } = { ids: [], todos: false }
): Promise<string> {
  const { data, error } = await client().rpc('send_ride_message', {
    p_ride_id: rideId,
    p_body: body.trim(),
    ...(replyTo ? { p_reply_to: replyTo } : {}),
    ...(mentions.ids.length > 0 ? { p_mentions: mentions.ids } : {}),
    ...(mentions.todos ? { p_mention_all: true } : {}),
  });
  if (error) throw refusal(error);
  return data;
}

/** Muda o texto de uma mensagem tua (até 15 minutos depois de a enviares). */
export async function editRideMessage(messageId: string, body: string) {
  const { error } = await client().rpc('edit_ride_message', {
    p_message_id: messageId,
    p_body: body.trim(),
  });
  if (error) throw refusal(error);
}

/** A tua reação a uma mensagem; `null` tira-a. */
export async function reactRideMessage(messageId: string, emoji: Emoji | null) {
  const { error } = await client().rpc('react_ride_message', {
    p_message_id: messageId,
    ...(emoji ? { p_emoji: emoji } : {}),
  });
  if (error) throw refusal(error);
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
