// Notificações do resto da app, chamadas por triggers da base de dados com o segredo do cron:
//
// - mensagem na conversa do carro -> aos outros que vão no carro;
// - convite para uma boleia       -> a quem foi convidado;
// - convite para um grupo         -> a quem foi convidado;
// - pedido de amizade             -> a quem o recebeu; e a aceitação -> a quem o tinha feito;
// - despesa lançada nas contas    -> a quem entra nela (menos quem a lançou);
// - pagamento registado           -> ao outro lado, que é quem tem de confirmar ou de saber.
//
// As notificações de boleias (pedidos de lugar, aceites, cancelamentos) vivem em `ride-notify`; esta função é para
// tudo o resto. Cada notificação abre o sítio da app onde a coisa aconteceu, e nada é enviado a quem desligou este
// tipo de aviso nem a quem não tem telemóvel registado.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';

import { hasCronSecret } from '../_shared/auth.ts';
import { sendExpoPush, type PushMessage } from '../_shared/expo-push.ts';

/** Os tipos que uma pessoa pode desligar nas definições. */
type Preferencia = 'ride_message' | 'invites' | 'friends' | 'trip_money';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

function euros(cents: number) {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

/** Uma mensagem de conversa numa notificação tem de caber numa linha. */
function resumir(corpo: string, maximo = 120) {
  const limpo = corpo.replace(/\s+/g, ' ').trim();
  return limpo.length <= maximo ? limpo : `${limpo.slice(0, maximo - 1)}…`;
}

async function nameOf(admin: SupabaseClient, profileId: string) {
  const { data } = await admin
    .from('profile')
    .select('display_name')
    .eq('id', profileId)
    .maybeSingle();
  return texto(data?.display_name) ?? 'Um adepto';
}

/** "Benfica x Porto", para a pessoa saber logo de que jogo se trata. */
async function gameOf(admin: SupabaseClient, fixtureId: string | null) {
  if (!fixtureId) return 'o jogo';
  const { data } = await admin
    .from('fixture')
    .select('home:home_club_id (short_name), away:away_club_id (short_name)')
    .eq('id', fixtureId)
    .maybeSingle();
  const casa = texto(asRecord(data?.home)?.short_name);
  const fora = texto(asRecord(data?.away)?.short_name);
  return casa && fora ? `${casa} x ${fora}` : 'o jogo';
}

/** Os telemóveis de quem quer receber este tipo de aviso. Quem o desligou fica de fora. */
async function tokensOf(
  admin: SupabaseClient,
  profileIds: readonly string[],
  preferencia: Preferencia
) {
  const pessoas = [...new Set(profileIds)].filter(Boolean);
  if (pessoas.length === 0) return [];

  const desligou = await admin
    .from('notification_preference')
    .select('profile_id')
    .eq('kind', preferencia)
    .eq('enabled', false)
    .in('profile_id', pessoas);
  const fora = new Set((desligou.data ?? []).map((row) => String(row.profile_id)));

  const querem = pessoas.filter((pessoa) => !fora.has(pessoa));
  if (querem.length === 0) return [];

  const { data } = await admin.from('device_token').select('token').in('profile_id', querem);
  return (data ?? []).map((row) => String(row.token));
}

/** Quem vai no carro: o condutor e quem foi aceite. */
async function ridePeople(admin: SupabaseClient, rideId: string) {
  const [boleia, passageiros] = await Promise.all([
    admin.from('ride').select('driver_id, fixture_id').eq('id', rideId).maybeSingle(),
    admin.from('ride_passenger').select('profile_id').eq('ride_id', rideId).eq('status', 'accepted'),
  ]);
  const condutor = texto(boleia.data?.driver_id);
  return {
    fixtureId: texto(boleia.data?.fixture_id),
    people: [condutor, ...(passageiros.data ?? []).map((row) => String(row.profile_id))].filter(
      (pessoa): pessoa is string => Boolean(pessoa)
    ),
  };
}

type Aviso = {
  recipients: string[];
  preferencia: Preferencia;
  title: string;
  body: string;
  data: Record<string, string>;
};

async function construir(
  admin: SupabaseClient,
  kind: string,
  body: Readonly<Record<string, unknown>>
): Promise<Aviso | null> {
  if (kind === 'ride_message') {
    const rideId = texto(body.ride_id);
    const autor = texto(body.profile_id);
    const mensagem = texto(body.body);
    if (!rideId || !autor || !mensagem) return null;

    const carro = await ridePeople(admin, rideId);
    const nome = await nameOf(admin, autor);
    return {
      recipients: carro.people.filter((pessoa) => pessoa !== autor),
      preferencia: 'ride_message',
      title: `${nome} escreveu na conversa do carro`,
      body: resumir(mensagem),
      data: { type: 'conversa', rideId, fixtureId: carro.fixtureId ?? '' },
    };
  }

  if (kind === 'ride_invite') {
    const rideId = texto(body.ride_id);
    const convidado = texto(body.profile_id);
    const quem = texto(body.invited_by);
    if (!rideId || !convidado) return null;

    const carro = await ridePeople(admin, rideId);
    const jogo = await gameOf(admin, carro.fixtureId);
    const nome = quem ? await nameOf(admin, quem) : 'Um amigo';
    return {
      recipients: [convidado],
      preferencia: 'invites',
      title: `${nome} tem lugar para ti`,
      body: `Boleia para ${jogo}. O lugar é teu se aceitares.`,
      data: { type: 'convite-boleia', rideId, fixtureId: carro.fixtureId ?? '' },
    };
  }

  if (kind === 'group_invite') {
    const groupId = texto(body.group_id);
    const convidado = texto(body.profile_id);
    const quem = texto(body.invited_by);
    if (!groupId || !convidado) return null;

    const grupo = await admin.from('fan_group').select('name').eq('id', groupId).maybeSingle();
    const nome = quem ? await nameOf(admin, quem) : 'Um amigo';
    return {
      recipients: [convidado],
      preferencia: 'invites',
      title: `${nome} convidou-te para um grupo`,
      body: `«${texto(grupo.data?.name) ?? 'Grupo'}» — entras se quiseres.`,
      data: { type: 'convite-grupo', groupId },
    };
  }

  if (kind === 'friend_request' || kind === 'friend_accepted') {
    const requester = texto(body.requester_id);
    const addressee = texto(body.addressee_id);
    if (!requester || !addressee) return null;

    if (kind === 'friend_request') {
      return {
        recipients: [addressee],
        preferencia: 'friends',
        title: `${await nameOf(admin, requester)} quer ser teu amigo`,
        body: 'Foram juntos a um jogo. Aceitas?',
        data: { type: 'amigos' },
      };
    }
    return {
      recipients: [requester],
      preferencia: 'friends',
      title: `${await nameOf(admin, addressee)} aceitou o teu pedido`,
      body: 'Já podes convidá-lo direto para o carro ou para um grupo.',
      data: { type: 'amigos' },
    };
  }

  if (kind === 'trip_expense') {
    const sessionId = texto(body.session_id);
    const expenseId = texto(body.expense_id);
    const autor = texto(body.created_by);
    const descricao = texto(body.description);
    const cents = typeof body.cents === 'number' ? body.cents : null;
    if (!sessionId || !expenseId || cents === null) return null;

    const [sessao, partes] = await Promise.all([
      admin.from('trip_session').select('fixture_id').eq('id', sessionId).maybeSingle(),
      admin.from('trip_expense_share').select('profile_id').eq('expense_id', expenseId),
    ]);
    const nome = autor ? await nameOf(admin, autor) : 'Alguém';
    return {
      recipients: (partes.data ?? [])
        .map((row) => String(row.profile_id))
        .filter((pessoa) => pessoa !== autor),
      preferencia: 'trip_money',
      title: `${nome} lançou ${euros(cents)} nas contas`,
      body: descricao ? `${descricao} — entras nesta divisão.` : 'Entras nesta divisão.',
      data: { type: 'contas', sessionId, fixtureId: texto(sessao.data?.fixture_id) ?? '' },
    };
  }

  if (kind === 'trip_settlement') {
    const sessionId = texto(body.session_id);
    const de = texto(body.from_profile_id);
    const para = texto(body.to_profile_id);
    const quem = texto(body.created_by);
    const cents = typeof body.cents === 'number' ? body.cents : null;
    if (!sessionId || !de || !para || cents === null) return null;

    const sessao = await admin
      .from('trip_session')
      .select('fixture_id')
      .eq('id', sessionId)
      .maybeSingle();
    const data = { type: 'contas', sessionId, fixtureId: texto(sessao.data?.fixture_id) ?? '' };

    // Quem regista é que decide o que o outro lado precisa de saber.
    if (quem === para) {
      return {
        recipients: [de],
        preferencia: 'trip_money',
        title: `${await nameOf(admin, para)} recebeu os teus ${euros(cents)}`,
        body: 'As contas já contam com esse pagamento.',
        data,
      };
    }
    return {
      recipients: [para],
      preferencia: 'trip_money',
      title: `${await nameOf(admin, de)} diz que te pagou ${euros(cents)}`,
      body: 'Confirma nas contas quando receberes.',
      data,
    };
  }

  return null;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!hasCronSecret(request)) return json(401, { error: 'not_authorized' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json(500, { error: 'misconfigured' });
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = asRecord(await request.json().catch(() => null));
  const kind = texto(body?.kind);
  if (!body || !kind) return json(400, { error: 'bad_request' });

  const aviso = await construir(admin, kind, body);
  if (!aviso || aviso.recipients.length === 0) return json(200, { sent: 0 });

  const tokens = await tokensOf(admin, aviso.recipients, aviso.preferencia);
  const messages: PushMessage[] = tokens.map((token) => ({
    to: token,
    title: aviso.title,
    body: aviso.body,
    data: aviso.data,
  }));

  const outcome = await sendExpoPush(messages);
  if (outcome.invalidTokens.length > 0) {
    await admin.from('device_token').delete().in('token', outcome.invalidTokens);
  }
  return json(200, { sent: outcome.sent, failed: outcome.failed });
});
