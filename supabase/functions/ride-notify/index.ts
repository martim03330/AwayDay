// Push notifications about rides, called by database triggers (ride_passenger and ride) with the cron secret:
// - a seat is requested            -> the driver ("Pedido de lugar", with the deadline to answer);
// - a request is accepted          -> the passenger (meeting point and time);
// - a request is declined/expires  -> the passenger;
// - a passenger leaves             -> the driver;
// - the driver cancels             -> every passenger with a seat;
// - a seat home is asked for       -> the driver (how far the fan is from the car and what they pay);
// - that request is answered       -> the fan.
// Every notification opens the ride. Nothing is sent to people without a registered phone.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';

import { hasCronSecret } from '../_shared/auth.ts';
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
  if (!hasCronSecret(request)) return json(401, { error: 'not_authorized' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json(500, { error: 'misconfigured' });
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = asRecord(await request.json().catch(() => null));
  const kind = body?.kind;
  const rideId = typeof body?.ride_id === 'string' ? body.ride_id : null;
  const status = typeof body?.status === 'string' ? body.status : null;
  const oldStatus = typeof body?.old_status === 'string' ? body.old_status : null;
  if (!rideId || !status) return json(400, { error: 'bad_request' });

  const ride = await admin
    .from('ride')
    .select(
      'id, fixture_id, driver_id, origin_name, departure_at, parking:parking_spot_id (name), fixture:fixture_id (home:home_club_id (short_name), away:away_club_id (short_name))'
    )
    .eq('id', rideId)
    .maybeSingle();
  if (ride.error || !ride.data) return json(404, { error: 'ride_not_found' });

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

  if (kind === 'passenger') {
    const passengerId = typeof body?.profile_id === 'string' ? body.profile_id : null;
    if (!passengerId) return json(400, { error: 'bad_request' });
    if (status === 'requested' && oldStatus !== 'requested') {
      recipients = [driverId];
      title = 'Pedido de lugar';
      text = `${await nameOf(admin, passengerId)} quer ir na tua boleia para ${jogo}. Responde até às ${hora(closes)}.`;
    } else if (status === 'accepted' && oldStatus === 'requested') {
      recipients = [passengerId];
      title = 'Tens lugar!';
      text = `${await nameOf(admin, driverId)} aceitou-te na boleia para ${jogo}. Encontro em ${ride.data.origin_name}, ${diaEHora(departure)}.`;
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
    const fanId = typeof body?.profile_id === 'string' ? body.profile_id : null;
    if (!fanId) return json(400, { error: 'bad_request' });
    const metros = typeof body?.distance_m === 'number' ? body.distance_m : null;
    const share = typeof body?.share_cents === 'number' ? body.share_cents : null;
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

  if (recipients.length === 0) return json(200, { sent: 0 });

  const tokens = await tokensOf(admin, recipients);
  const messages: PushMessage[] = tokens.map((to) => ({ to, title, body: text, data }));
  const outcome = await sendExpoPush(messages);
  if (outcome.invalidTokens.length > 0) {
    await admin.from('device_token').delete().in('token', outcome.invalidTokens);
  }
  return json(200, { sent: outcome.sent, failed: outcome.failed });
});
