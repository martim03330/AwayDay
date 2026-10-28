// Push notifications about «Viagens da Casa», called by database triggers (club_trip, club_trip_booking,
// club_trip_notice) with the notification secret (NOTIFY_SECRET). The trigger sends only the row's key and statuses;
// every status and value shown is read again here, so a forged request cannot make up a trip, a seat or a notice:
// - a trip is published          -> the fans of the area and the Casa's followers, once per game, unless they turned
//                                   «Autocarros das Casas» (`club_trips`) off (claim_club_trip_alerts decides who);
// - a trip is cancelled          -> everyone booked or waiting in it (one call for all its bookings);
// - waiting -> booked            -> that person;
// - waiting -> other transport   -> that person (left the waiting list);
// - a notice of the Casa         -> everyone booked or waiting, unless they blocked whoever wrote it.
// Every notification opens the trip. Nothing is sent to people without a registered phone.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';

import { hasNotifySecret } from '../_shared/auth.ts';
import { alertTitle, lisbonTime } from '../_shared/club-trip-alert.ts';
import { sendExpoPush, type PushMessage } from '../_shared/expo-push.ts';

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

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

/** The phones of these people, 100 at a time (a full bus is too long for one filter in the URL). */
async function tokensOf(admin: SupabaseClient, profileIds: readonly string[]) {
  const tokens: string[] = [];
  const ids = [...new Set(profileIds)];
  for (let start = 0; start < ids.length; start += 100) {
    const { data } = await admin
      .from('device_token')
      .select('token')
      .in('profile_id', ids.slice(start, start + 100));
    tokens.push(...(data ?? []).map((row) => String(row.token)));
  }
  return tokens;
}

/** Everyone with an account booked or waiting in the trip (or cancelled with it, for `trip_cancelled`). */
async function bookersOf(admin: SupabaseClient, tripId: string, which: 'live' | 'trip_cancelled') {
  const query = admin.from('club_trip_booking').select('profile_id').eq('trip_id', tripId).not('profile_id', 'is', null);
  const { data } =
    which === 'live'
      ? await query.in('status', ['booked', 'waiting'])
      : await query.eq('status', 'cancelled').eq('cancel_reason', 'trip_cancelled');
  return (data ?? []).map((row) => String(row.profile_id));
}

type Trip = { id: string; status: string; fixtureId: string; createdBy: string | null; casa: string; jogo: string };

async function tripOf(admin: SupabaseClient, tripId: string): Promise<Trip | null> {
  const { data, error } = await admin
    .from('club_trip')
    .select(
      'id, status, fixture_id, created_by, casa:supporters_club_id (name), fixture:fixture_id (home:home_club_id (short_name), away:away_club_id (short_name))'
    )
    .eq('id', tripId)
    .maybeSingle();
  if (error || !data) return null;
  const fixture = asRecord(data.fixture);
  const home = text(asRecord(fixture?.home)?.short_name);
  const away = text(asRecord(fixture?.away)?.short_name);
  return {
    id: String(data.id),
    status: String(data.status),
    fixtureId: String(data.fixture_id),
    createdBy: text(data.created_by),
    casa: text(asRecord(data.casa)?.name) ?? 'Casa',
    jogo: home && away ? `${home} x ${away}` : 'o jogo',
  };
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
  const id = text(body?.id);
  const oldStatus = text(body?.old_status);
  if (!id || (kind !== 'trip' && kind !== 'booking' && kind !== 'notice')) return json(400, { error: 'bad_request' });

  let tokens: string[] = [];
  let title = '';
  let message = '';
  let trip: Trip | null = null;

  if (kind === 'trip') {
    trip = await tripOf(admin, id);
    if (!trip) return json(404, { error: 'trip_not_found' });

    if (trip.status === 'open' && oldStatus === null) {
      // A new trip: who hears about it is decided (and recorded, once per game) in the database.
      const [primeira, alertados] = await Promise.all([
        admin
          .from('club_trip_stop')
          .select('name, passes_at')
          .eq('trip_id', trip.id)
          .order('position')
          .limit(1)
          .maybeSingle(),
        admin.rpc('claim_club_trip_alerts', { p_trip_id: trip.id }),
      ]);
      const paragem = text(primeira.data?.name);
      const hora = text(primeira.data?.passes_at);
      const ids = Array.isArray(alertados.data)
        ? alertados.data.filter((value): value is string => typeof value === 'string')
        : [];
      if (!paragem || !hora || ids.length === 0) return json(200, { sent: 0 });
      ({ title, body: message } = alertTitle(trip.casa, trip.jogo, paragem, hora));
      tokens = await tokensOf(admin, ids);
    } else if (trip.status === 'cancelled') {
      title = 'Viagem cancelada';
      message = `A viagem da ${trip.casa} para ${trip.jogo} foi cancelada.`;
      tokens = await tokensOf(admin, await bookersOf(admin, trip.id, 'trip_cancelled'));
    }
  } else if (kind === 'booking') {
    const { data: reserva } = await admin
      .from('club_trip_booking')
      .select('trip_id, profile_id, status, cancel_reason, stop:stop_id (name, passes_at), vehicle:vehicle_id (label)')
      .eq('id', id)
      .maybeSingle();
    const pessoa = text(reserva?.profile_id);
    if (!reserva || !pessoa || oldStatus !== 'waiting') return json(200, { sent: 0 });
    trip = await tripOf(admin, String(reserva.trip_id));
    if (!trip || trip.status === 'cancelled') return json(200, { sent: 0 });

    if (reserva.status === 'booked') {
      const paragem = asRecord(reserva.stop);
      const nome = text(paragem?.name);
      const hora = text(paragem?.passes_at);
      const carro = text(asRecord(reserva.vehicle)?.label);
      title = 'Tens lugar no autocarro';
      message = `${trip.jogo}: já tens lugar${carro ? ` (${carro})` : ''}.${
        nome && hora ? ` Sai de ${nome} às ${lisbonTime(hora)}.` : ''
      }`;
      tokens = await tokensOf(admin, [pessoa]);
    } else if (reserva.status === 'cancelled' && reserva.cancel_reason === 'other_transport') {
      title = 'Saíste da lista de espera';
      message = `Já tens outro transporte para ${trip.jogo}.`;
      tokens = await tokensOf(admin, [pessoa]);
    }
  } else {
    const { data: aviso } = await admin
      .from('club_trip_notice')
      .select('trip_id, body, created_by')
      .eq('id', id)
      .maybeSingle();
    const texto = text(aviso?.body);
    if (!aviso || !texto) return json(200, { sent: 0 });
    trip = await tripOf(admin, String(aviso.trip_id));
    if (!trip || trip.status === 'cancelled') return json(200, { sent: 0 });
    const ids = await bookersOf(admin, trip.id, 'live');
    if (ids.length > 0) {
      // Whoever blocked the manager who wrote it is left out, as in the other notices.
      const { data: lidos } = await admin.rpc('push_tokens_for', {
        p_recipients: [...new Set(ids)],
        p_from: text(aviso.created_by),
        p_kind: null,
      });
      tokens = Array.isArray(lidos) ? lidos.filter((token): token is string => typeof token === 'string') : [];
    }
    title = trip.casa;
    message = texto;
  }

  if (!trip || tokens.length === 0 || !title) return json(200, { sent: 0 });
  const data = { type: 'viagem-casa', tripId: trip.id, fixtureId: trip.fixtureId };
  const messages: PushMessage[] = tokens.map((to) => ({ to, title, body: message, data }));

  const outcome = await sendExpoPush(messages);
  if (outcome.invalidTokens.length > 0) {
    await admin.from('device_token').delete().in('token', outcome.invalidTokens);
  }
  return json(200, { sent: outcome.sent, failed: outcome.failed });
});
