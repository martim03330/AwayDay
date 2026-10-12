// Notificações do resto da app, chamadas por triggers da base de dados com o segredo das notificações
// (NOTIFY_SECRET). Os triggers só mandam o tipo e a chave da linha; tudo o resto (texto, valores, quem) é lido outra
// vez aqui, na base de dados, para que um pedido forjado não possa pôr palavras na boca de ninguém:
//
// - mensagem na conversa do carro -> aos outros que vão no carro;
// - mensagem na conversa do grupo -> aos outros do grupo (e o «estou aqui» num tasco e o convite para um jogo, que
//   também são mensagens);
// - convite para uma boleia       -> a quem foi convidado;
// - convite para um grupo         -> a quem foi convidado;
// - pedido de amizade             -> a quem o recebeu; e a aceitação -> a quem o tinha feito;
// - despesa lançada nas contas    -> a quem entra nela (menos quem a lançou);
// - pagamento registado           -> ao outro lado, que é quem tem de confirmar ou de saber.
//
// As notificações de boleias (pedidos de lugar, aceites, cancelamentos) vivem em `ride-notify`; esta função é para
// tudo o resto. Cada notificação abre o sítio da app onde a coisa aconteceu, e nada é enviado a quem desligou este
// tipo de aviso nem a quem não tem telemóvel registado — exceto uma menção («@Nome» ou «@todos»), que chega sempre,
// como no WhatsApp. Quem bloqueou o autor de uma mensagem, de um convite ou de um
// pedido de amizade também não recebe nada dele.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';

import { hasNotifySecret } from '../_shared/auth.ts';
import { sendExpoPush, type PushMessage } from '../_shared/expo-push.ts';

/** Os tipos que uma pessoa pode desligar nas definições. */
type Preferencia = 'ride_message' | 'group_message' | 'invites' | 'friends' | 'trip_money';

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
  preferencia: Preferencia | null
) {
  const pessoas = [...new Set(profileIds)].filter(Boolean);
  if (pessoas.length === 0) return [];

  const desligou = preferencia
    ? await admin
        .from('notification_preference')
        .select('profile_id')
        .eq('kind', preferencia)
        .eq('enabled', false)
        .in('profile_id', pessoas)
    : { data: [] };
  const fora = new Set((desligou.data ?? []).map((row) => String(row.profile_id)));

  const querem = pessoas.filter((pessoa) => !fora.has(pessoa));
  if (querem.length === 0) return [];

  const { data } = await admin.from('device_token').select('token').in('profile_id', querem);
  return (data ?? []).map((row) => String(row.token));
}

/** Leaves out whoever blocked the person who caused the notification. */
async function withoutBlockers(admin: SupabaseClient, recipients: string[], from?: string) {
  if (!from) return recipients;
  const { data } = await admin
    .from('user_block')
    .select('blocker_id')
    .eq('blocked_id', from)
    .in('blocker_id', recipients);
  const bloquearam = new Set((data ?? []).map((row) => String(row.blocker_id)));
  return recipients.filter((pessoa) => !bloquearam.has(pessoa));
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
  /** Who caused it: anyone who blocked this person is left out. */
  from?: string;
  /** `null`: goes even to whoever turned this kind off (a mention, like in WhatsApp). */
  preferencia: Preferencia | null;
  title: string;
  body: string;
  data: Record<string, string>;
};

/** Who a chat message mentions: everyone in the chat with «@todos», or the people the server kept. */
function mencionados(body: Readonly<Record<string, unknown>>, naConversa: readonly string[], autor: string) {
  const todos = body.mentions_all === true;
  const lista = Array.isArray(body.mentions) ? body.mentions.filter((id): id is string => typeof id === 'string') : [];
  return { todos, pessoas: (todos ? naConversa : lista).filter((pessoa) => pessoa !== autor) };
}

/**
 * A chat message as notifications: whoever was mentioned gets «X mencionou-te» (even with that chat turned off), the
 * others the usual one.
 */
async function comMencoes(
  admin: SupabaseClient,
  normal: Aviso,
  body: Readonly<Record<string, unknown>>,
  autor: string,
  nome: string,
  onde: string
) {
  const mencao = mencionados(body, normal.recipients, autor);
  if (mencao.pessoas.length === 0) return [normal];
  // At most 5 an hour from the same person to the same person go through as «mencionou-te» (they reach even who
  // muted the chat); past that, the mention is just a message like the others.
  const vagas = await admin.rpc('mention_slots', { p_sender: autor, p_recipients: mencao.pessoas });
  const passam = Array.isArray(vagas.data) ? vagas.data.filter((id): id is string => typeof id === 'string') : [];
  if (passam.length === 0) return [normal];
  mencao.pessoas = passam;
  const ja = new Set(mencao.pessoas);
  return [
    {
      ...normal,
      recipients: mencao.pessoas,
      preferencia: null,
      title: mencao.todos ? `${nome} mencionou todos` : `${nome} mencionou-te`,
      body: `${onde}: ${resumir(texto(body.body) ?? '')}`,
    },
    { ...normal, recipients: normal.recipients.filter((pessoa) => !ja.has(pessoa)) },
  ];
}

/**
 * The trusted version of what happened: from the kind and the row's key sent by the trigger, the row as it is in the
 * database, in the shape `construir` reads. `null` when the row is gone (nothing to say) or the request is malformed.
 */
async function carregar(
  admin: SupabaseClient,
  kind: string,
  pedido: Readonly<Record<string, unknown>>
): Promise<{ kind: string; body: Readonly<Record<string, unknown>> } | null> {
  if (kind === 'group_message') {
    const id = texto(pedido.message_id);
    if (!id) return null;
    const { data } = await admin
      .from('group_message')
      .select('group_id, profile_id, kind, body, plan_id, mentions, mentions_all, hidden_at')
      .eq('id', id)
      .maybeSingle();
    if (!data || data.hidden_at) return null;
    return { kind, body: { ...data, message_kind: data.kind } };
  }
  if (kind === 'ride_message') {
    const id = texto(pedido.message_id);
    if (!id) return null;
    const { data } = await admin
      .from('ride_message')
      .select('ride_id, profile_id, body, mentions, mentions_all, hidden_at')
      .eq('id', id)
      .maybeSingle();
    if (!data || data.hidden_at) return null;
    return { kind, body: data };
  }
  if (kind === 'ride_invite' || kind === 'group_invite') {
    const chave = kind === 'ride_invite' ? 'ride_id' : 'group_id';
    const alvo = texto(pedido[chave]);
    const convidado = texto(pedido.profile_id);
    if (!alvo || !convidado) return null;
    const { data } = await admin
      .from(kind)
      .select(`${chave}, profile_id, invited_by`)
      .eq(chave, alvo)
      .eq('profile_id', convidado)
      .maybeSingle();
    return data ? { kind, body: data } : null;
  }
  if (kind === 'friendship') {
    const requester = texto(pedido.requester_id);
    const addressee = texto(pedido.addressee_id);
    if (!requester || !addressee) return null;
    const { data } = await admin
      .from('friendship')
      .select('requester_id, addressee_id, status')
      .eq('requester_id', requester)
      .eq('addressee_id', addressee)
      .maybeSingle();
    if (!data) return null;
    return { kind: data.status === 'aceite' ? 'friend_accepted' : 'friend_request', body: data };
  }
  if (kind === 'trip_expense') {
    const id = texto(pedido.expense_id);
    if (!id) return null;
    const { data } = await admin
      .from('trip_expense')
      .select('id, session_id, payer_id, created_by, description, cents, source')
      .eq('id', id)
      .maybeSingle();
    if (!data || data.source !== 'manual') return null;
    return { kind, body: { ...data, expense_id: data.id } };
  }
  if (kind === 'trip_settlement') {
    const id = texto(pedido.settlement_id);
    if (!id) return null;
    const { data } = await admin
      .from('trip_settlement')
      .select('session_id, from_profile_id, to_profile_id, created_by, cents')
      .eq('id', id)
      .maybeSingle();
    return data ? { kind, body: data } : null;
  }
  return null;
}

async function construir(
  admin: SupabaseClient,
  kind: string,
  body: Readonly<Record<string, unknown>>
): Promise<Aviso | Aviso[] | null> {
  if (kind === 'ride_message') {
    const rideId = texto(body.ride_id);
    const autor = texto(body.profile_id);
    const mensagem = texto(body.body);
    if (!rideId || !autor || !mensagem) return null;

    const carro = await ridePeople(admin, rideId);
    const nome = await nameOf(admin, autor);
    const normal: Aviso = {
      recipients: carro.people.filter((pessoa) => pessoa !== autor),
      from: autor,
      preferencia: 'ride_message',
      title: `${nome} escreveu na conversa do carro`,
      body: resumir(mensagem),
      data: { type: 'conversa', rideId, fixtureId: carro.fixtureId ?? '' },
    };
    return comMencoes(admin, normal, body, autor, nome, 'Conversa do carro');
  }

  if (kind === 'group_message') {
    const groupId = texto(body.group_id);
    const autor = texto(body.profile_id);
    const mensagem = texto(body.body);
    if (!groupId || !autor || !mensagem) return null;

    const [grupo, membros] = await Promise.all([
      admin.from('fan_group').select('name').eq('id', groupId).maybeSingle(),
      admin.from('fan_group_member').select('profile_id').eq('group_id', groupId),
    ]);
    const nome = await nameOf(admin, autor);
    const nomeDoGrupo = texto(grupo.data?.name) ?? 'Grupo';
    const local = body.message_kind === 'local';
    const plano = body.message_kind === 'plano';
    const aviso = body.message_kind === 'aviso';
    // A plan sent from another group says which group it comes from, so nobody takes it for one of theirs.
    let deOutroGrupo: string | null = null;
    const planId = texto(body.plan_id);
    if (plano && planId) {
      const origem = await admin.from('fixture_plan').select('group_id, fan_group(name)').eq('id', planId).maybeSingle();
      const grupoDeOrigem = origem.data as { group_id: string; fan_group: { name: string } | null } | null;
      if (grupoDeOrigem && grupoDeOrigem.group_id !== groupId) deOutroGrupo = texto(grupoDeOrigem.fan_group?.name);
    }
    const normal: Aviso = {
      recipients: (membros.data ?? [])
        .map((row) => String(row.profile_id))
        .filter((pessoa) => pessoa !== autor),
      from: autor,
      preferencia: 'group_message',
      title: nomeDoGrupo,
      body: aviso
        ? resumir(mensagem)
        : plano
          ? deOutroGrupo
            ? `${nome} (${deOutroGrupo}) convida-vos para ${mensagem}. Vão?`
            : `${nome} convida-te para ${mensagem}. Vais?`
          : local
            ? `${nome} está ${mensagem}`
            : `${nome}: ${resumir(mensagem)}`,
      data: { type: 'grupo', groupId },
    };
    // Only people's own text messages carry mentions.
    return local || plano || aviso ? normal : comMencoes(admin, normal, body, autor, nome, nomeDoGrupo);
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
      from: quem ?? undefined,
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
      from: quem ?? undefined,
      preferencia: 'invites',
      title: `${nome} convidou-te para um grupo`,
      body: `«${texto(grupo.data?.name) ?? 'Grupo'}». Entras se quiseres.`,
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
        from: requester,
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
    const pagador = texto(body.payer_id);
    const data = { type: 'contas', sessionId, fixtureId: texto(sessao.data?.fixture_id) ?? '' };
    const divisao: Aviso = {
      recipients: (partes.data ?? [])
        .map((row) => String(row.profile_id))
        .filter((pessoa) => pessoa !== autor && pessoa !== pagador),
      preferencia: 'trip_money',
      title: `${nome} lançou ${euros(cents)} nas contas`,
      body: descricao ? `${descricao}. Entras nesta divisão.` : 'Entras nesta divisão.',
      data,
    };
    // Recorded in someone else's name: the payer always hears about it, so a wrong one is caught at once.
    if (!pagador || pagador === autor) return divisao;
    return [
      divisao,
      {
        recipients: [pagador],
        // Even with money notices turned off: it is about money said to be theirs.
        preferencia: null,
        title: `${nome} registou que pagaste ${euros(cents)}`,
        body: `${descricao ? `${descricao}. ` : ''}Se não foste tu, podes apagá-la nas contas.`,
        data,
      },
    ];
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
  if (!hasNotifySecret(request)) return json(401, { error: 'not_authorized' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json(500, { error: 'misconfigured' });
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = asRecord(await request.json().catch(() => null));
  const kind = texto(body?.kind);
  if (!body || !kind) return json(400, { error: 'bad_request' });

  const confiavel = await carregar(admin, kind, body);
  if (!confiavel) return json(200, { sent: 0 });

  const construido = await construir(admin, confiavel.kind, confiavel.body);
  const avisos = (Array.isArray(construido) ? construido : construido ? [construido] : []).filter(
    (aviso) => aviso.recipients.length > 0
  );
  if (avisos.length === 0) return json(200, { sent: 0 });

  const messages: PushMessage[] = [];
  for (const aviso of avisos) {
    const recipients = await withoutBlockers(admin, aviso.recipients, aviso.from);
    if (recipients.length === 0) continue;
    const tokens = await tokensOf(admin, recipients, aviso.preferencia);
    messages.push(
      ...tokens.map((token) => ({ to: token, title: aviso.title, body: aviso.body, data: aviso.data }))
    );
  }
  if (messages.length === 0) return json(200, { sent: 0 });

  const outcome = await sendExpoPush(messages);
  if (outcome.invalidTokens.length > 0) {
    await admin.from('device_token').delete().in('token', outcome.invalidTokens);
  }
  return json(200, { sent: outcome.sent, failed: outcome.failed });
});
