// Push notifications about rides, called by database triggers (ride_passenger and ride) with the notification
// secret (NOTIFY_SECRET). The trigger sends the row's key and the previous status; the current status and every value
// shown are read again here, so a forged request cannot make up a request, an amount or a distance:
// - a seat is requested            -> the driver ("Pedido de lugar", with the deadline to answer);
// - a request is accepted          -> the passenger (meeting point and time);
// - a request is declined/expires  -> the passenger;
// - a passenger leaves             -> the driver;
// - the driver cancels             -> every passenger with a seat;
// - a seat home is asked for       -> the driver (how far the fan is from the car and what they pay);
// - that request is answered       -> the fan.
// And two that can be turned off with the «Boleias» switch (`rides`), skipping whoever blocked the person:
// - someone gets a seat             -> the rest of the car (the driver too, unless they accepted it themselves);
// - a ride is put in a plan         -> whoever answered «Vou» or «Talvez» and is not in the car yet.
// Every notification opens the ride. Nothing is sent to people without a registered phone.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';

import { hasNotifySecret } from '../_shared/auth.ts';
import { sendExpoPush, type PushMessage } from '../_shared/expo-push.ts';

const TIME_ZONE = 'Europe/Lisbon';

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

function hora(iso: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function diaEHora(iso: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** "1,2 km" or "600 m": how far the fan is from the car, as the driver reads it. */
function distancia(metros: number) {
  return metros >= 1000
    ? `${(metros / 1000).toFixed(1).replace('.', ',')} km`
    : `${Math.round(metros)} m`;
}

function euros(cents: number) {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

function lugares(n: number) {
  return n === 1 ? '1 lugar' : `${n} lugares`;
}

/** A notice that follows the `rides` switch and the recipients' blocks (see push_tokens_for). */
type AvisoDeBoleia = { recipients: string[]; from: string; title: string; text: string };

async function tokensOf(admin: SupabaseClient, profileIds: readonly string[]) {
  if (profileIds.length === 0) return [];
  const { data } = await admin.from('device_token').select('token').in('profile_id', profileIds);
  return (data ?? []).map((row) => String(row.token));
}

async function nameOf(admin: SupabaseClient, profileId: string) {
  const { data } = await admin
    .from('profile')
    .select('display_name')
    .eq('id', profileId)
    .maybeSingle();
  return typeof data?.display_name === 'string' && data.display_name
    ? data.display_name
    : 'Um adepto';
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
  const kind = body?.kind;
  const rideId = typeof body?.ride_id === 'string' ? body.ride_id : null;
  const oldStatus = typeof body?.old_status === 'string' ? body.old_status : null;
  const profileId = typeof body?.profile_id === 'string' ? body.profile_id : null;
  const planId = typeof body?.plan_id === 'string' ? body.plan_id : null;
  if (!rideId) return json(400, { error: 'bad_request' });

  // The row as it is now: its status (and, for a seat home, the distance and the share) come from here.
  let status: string | null = null;
  let metros: number | null = null;
  let share: number | null = null;
  if (kind === 'passenger' || kind === 'return') {
    if (!profileId) return json(400, { error: 'bad_request' });
    const linha =
      kind === 'passenger'
        ? await admin
            .from('ride_passenger')
            .select('status')
            .eq('ride_id', rideId)
            .eq('profile_id', profileId)
            .maybeSingle()
        : await admin
            .from('ride_return_request')
            .select('status, distance_to_car_m, share_cents')
            .eq('ride_id', rideId)
            .eq('profile_id', profileId)
            .maybeSingle();
    if (!linha.data) return json(200, { sent: 0 });
    const lida = asRecord(linha.data);
    status = typeof lida?.status === 'string' ? lida.status : null;
    metros = typeof lida?.distance_to_car_m === 'number' ? lida.distance_to_car_m : null;
    share = typeof lida?.share_cents === 'number' ? lida.share_cents : null;
  }

  const ride = await admin
    .from('ride')
    .select(
      'id, status, fixture_id, driver_id, seats_offered, origin_name, departure_at, parking:parking_spot_id (name), fixture:fixture_id (home:home_club_id (short_name), away:away_club_id (short_name))'
    )
    .eq('id', rideId)
    .maybeSingle();
  if (ride.error || !ride.data) return json(404, { error: 'ride_not_found' });
  if (kind === 'ride' || kind === 'plan_ride') {
    status = typeof ride.data.status === 'string' ? ride.data.status : null;
  }
  if (!status) return json(200, { sent: 0 });

  const fixture = asRecord(ride.data.fixture);
  const home = asRecord(fixture?.home)?.short_name;
  const away = asRecord(fixture?.away)?.short_name;
  const jogo =
    typeof home === 'string' && typeof away === 'string' ? `${home} x ${away}` : 'o jogo';
  const departure = String(ride.data.departure_at);
  const closes = new Date(Date.parse(departure) - 2 * 60 * 60 * 1000).toISOString();
  const driverId = String(ride.data.driver_id);
  const data = { type: 'boleia', rideId, fixtureId: String(ride.data.fixture_id) };

  let recipients: string[] = [];
  let title = '';
  let text = '';
  let aviso: AvisoDeBoleia | null = null;

  /** Who has a seat now, and how many seats are left. */
  async function noCarro() {
    const { data: lugaresTomados } = await admin
      .from('ride_passenger')
      .select('profile_id, status')
      .eq('ride_id', rideId)
      .in('status', ['accepted', 'requested']);
    const linhas = (lugaresTomados ?? []).map((row) => ({ id: String(row.profile_id), status: String(row.status) }));
    const aceites = linhas.filter((linha) => linha.status === 'accepted').map((linha) => linha.id);
    return { aceites, todos: linhas.map((linha) => linha.id), livres: Number(ride.data?.seats_offered ?? 0) - aceites.length };
  }

  if (kind === 'passenger') {
    const passengerId = profileId;
    if (!passengerId) return json(400, { error: 'bad_request' });
    if (status === 'requested' && oldStatus !== 'requested') {
      // Someone the driver blocked does not reach them, as in the other notifications.
      const blocked = await admin
        .from('user_block')
        .select('blocker_id')
        .eq('blocker_id', driverId)
        .eq('blocked_id', passengerId)
        .maybeSingle();
      if (blocked.data) return json(200, { sent: 0 });
      recipients = [driverId];
      title = 'Pedido de lugar';
      text = `${await nameOf(admin, passengerId)} quer ir na tua boleia para ${jogo}. Responde até às ${hora(closes)}.`;
    } else if (status === 'accepted' && oldStatus !== 'accepted') {
      const [carro, nomeDoPassageiro] = await Promise.all([noCarro(), nameOf(admin, passengerId)]);
      if (oldStatus === 'requested') {
        recipients = [passengerId];
        title = 'Tens lugar!';
        text = `${await nameOf(admin, driverId)} aceitou-te na boleia para ${jogo}. Encontro em ${ride.data.origin_name}, ${diaEHora(departure)}.`;
      }
      // The rest of the car. The driver who accepted the request already knows; one who did not (someone joined
      // straight from a plan or an invite) is told too.
      aviso = {
        recipients: [
          ...carro.aceites.filter((id) => id !== passengerId),
          ...(oldStatus === 'requested' ? [] : [driverId]),
        ],
        from: passengerId,
        title: `Boleia para ${jogo}`,
        text: `${nomeDoPassageiro} entrou no carro. ${
          carro.livres > 0 ? `${carro.livres === 1 ? 'Sobra' : 'Sobram'} ${lugares(carro.livres)}.` : 'O carro está cheio.'
        }`,
      };
    } else if (status === 'declined' && oldStatus === 'requested') {
      recipients = [passengerId];
      title = 'Pedido recusado';
      text = `Não foi desta na boleia para ${jogo}. Vê se há outra com lugar.`;
    } else if (status === 'expired' && oldStatus === 'requested') {
      recipients = [passengerId];
      title = 'Pedido sem resposta';
      text = `O condutor não respondeu a tempo para ${jogo}. Vê se há outra boleia com lugar.`;
    } else if ((status === 'left' || status === 'left_late') && oldStatus === 'accepted') {
      recipients = [driverId];
      title = 'Saiu da tua boleia';
      text = `${await nameOf(admin, passengerId)} já não vai na tua boleia para ${jogo}. O lugar ficou livre.`;
    }
  } else if (kind === 'return') {
    // A seat home for someone who missed their transport: it is decided in the next minutes, so it goes out at once.
    const fanId = profileId;
    if (!fanId) return json(400, { error: 'bad_request' });
    const parque = asRecord(ride.data.parking)?.name;
    if (status === 'pending') {
      recipients = [driverId];
      title = 'Pedido de boleia de volta';
      text = `${await nameOf(admin, fanId)} ficou sem transporte no ${jogo}${
        metros !== null ? ` e está a ${distancia(metros)} do carro` : ''
      }.${share !== null ? ` Paga ${euros(share)} da volta.` : ''}`;
    } else if (status === 'accepted') {
      recipients = [fanId];
      title = 'Tens boleia de volta!';
      text = `${await nameOf(admin, driverId)} leva-te de volta${
        typeof parque === 'string' ? `. O carro ficou no ${parque}` : ''
      }. Combina já onde se encontram.`;
    } else if (status === 'declined') {
      recipients = [fanId];
      title = 'Sem boleia de volta';
      text = `Não foi desta. Vê se há outro carro a voltar do ${jogo}.`;
    }
  } else if (kind === 'plan_ride' && status === 'open') {
    // The plan is read again: the car must still be the plan's, and the plan still open.
    if (!planId) return json(400, { error: 'bad_request' });
    const plano = await admin.from('fixture_plan').select('ride_id, status').eq('id', planId).maybeSingle();
    if (plano.data?.ride_id !== rideId || plano.data?.status !== 'aberto') return json(200, { sent: 0 });
    const [respostas, carro, nomeDoCondutor] = await Promise.all([
      admin.from('fixture_plan_answer').select('profile_id').eq('plan_id', planId).in('answer', ['vou', 'talvez']),
      noCarro(),
      nameOf(admin, driverId),
    ]);
    if (carro.livres > 0) {
      aviso = {
        recipients: (respostas.data ?? [])
          .map((row) => String(row.profile_id))
          .filter((id) => id !== driverId && !carro.todos.includes(id)),
        from: driverId,
        title: `Há boleia para ${jogo}`,
        text: `${nomeDoCondutor} tem ${lugares(carro.livres)} no carro. Pede o teu antes que acabem.`,
      };
    }
  } else if (kind === 'ride' && status === 'cancelled') {
    const passengers = await admin
      .from('ride_passenger')
      .select('profile_id')
      .eq('ride_id', rideId)
      .in('status', ['accepted', 'requested']);
    recipients = (passengers.data ?? []).map((row) => String(row.profile_id));
    title = 'Boleia cancelada';
    text = `${await nameOf(admin, driverId)} cancelou a boleia para ${jogo}. Vê se há outra com lugar.`;
  }

  const [tokens, tokensDoAviso] = await Promise.all([
    tokensOf(admin, recipients),
    aviso && aviso.recipients.length > 0
      ? admin
          .rpc('push_tokens_for', { p_recipients: [...new Set(aviso.recipients)], p_from: aviso.from, p_kind: 'rides' })
          .then(({ data: lidos }) => (Array.isArray(lidos) ? lidos.filter((token): token is string => typeof token === 'string') : []))
      : Promise.resolve([]),
  ]);
  const messages: PushMessage[] = [
    ...tokens.map((to) => ({ to, title, body: text, data })),
    ...(aviso ? tokensDoAviso.map((to) => ({ to, title: aviso.title, body: aviso.text, data })) : []),
  ];
  if (messages.length === 0) return json(200, { sent: 0 });

  const outcome = await sendExpoPush(messages);
  if (outcome.invalidTokens.length > 0) {
    await admin.from('device_token').delete().in('token', outcome.invalidTokens);
  }
  return json(200, { sent: outcome.sent, failed: outcome.failed });
});
