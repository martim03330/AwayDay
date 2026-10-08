// The weather at kick-off for the coming games, from free sources with no keys: IPMA for venues in Portugal (and its
// orange and red warnings), MET Norway abroad. pg_cron calls it every hour with a secret header. Forecasts are cached
// in public.fixture_weather, which the app reads; the app never calls a weather service.
//
// The same run sends the weather push about 3 hours before kick-off to who said they are going (fixture_attendance),
// once per person and game (weather_notice), unless they turned weather notices off.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

import { hasCronSecret } from '../_shared/auth.ts';
import { sendExpoPush } from '../_shared/expo-push.ts';
import {
  ipmaKickoffWeather,
  ipmaWarning,
  metKickoffWeather,
  nearestIpmaLocation,
  parseIpmaLocations,
  weatherNotice,
  type IpmaLocation,
  type KickoffWeather,
  type RoofCoverage,
  type Warning,
} from '../_shared/weather.ts';

const IPMA_LOCATIONS = 'https://api.ipma.pt/public-data/forecast/locations.json';
const IPMA_FORECAST = 'https://api.ipma.pt/public-data/forecast/aggregate';
const IPMA_WARNINGS = 'https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json';
const MET_FORECAST = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
// MET Norway's terms ask every client to identify itself.
const USER_AGENT = 'AwayDay/1.0 github.com/martim03330/AwayDay';

const HOUR_MS = 60 * 60 * 1000;
/** How far ahead to forecast: IPMA's hourly and 3-hourly slots reach about 6 days. */
const HORIZON_MS = 6 * 24 * HOUR_MS;
/** Games whose kick-off falls in this window get the push in this run (the job runs every hour). */
const NOTICE_FROM_MS = 2 * HOUR_MS;
const NOTICE_TO_MS = 4 * HOUR_MS;
const NOTICE_KEEP_MS = 30 * 24 * HOUR_MS;

type Venue = {
  id: string;
  name: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  roof_coverage: RoofCoverage;
};

type Fixture = { id: string; kickoff_at: string; venue_id: string };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function fetchJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.error(`${new URL(url).host} answered ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`${new URL(url).host} failed:`, error instanceof Error ? error.message : error);
    return null;
  }
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

  const now = Date.now();
  const fixturesResult = await admin
    .from('fixture')
    .select('id, kickoff_at, venue_id')
    .gt('kickoff_at', new Date(now).toISOString())
    .lt('kickoff_at', new Date(now + HORIZON_MS).toISOString());
  if (fixturesResult.error) return json(500, { error: 'fixtures_failed' });
  const fixtures = (fixturesResult.data ?? []) as Fixture[];

  const summary = { fixtures: fixtures.length, forecasts: 0, missing: 0, notices: 0, pushed: 0 };
  if (fixtures.length === 0) return json(200, summary);

  const venuesResult = await admin
    .from('venue')
    .select('id, name, country, latitude, longitude, roof_coverage')
    .in('id', [...new Set(fixtures.map((fixture) => fixture.venue_id))]);
  if (venuesResult.error) return json(500, { error: 'venues_failed' });
  const venues = new Map((venuesResult.data as Venue[]).map((venue) => [venue.id, venue]));

  const anyPortuguese = [...venues.values()].some((venue) => venue.country === 'Portugal');
  const [locationsPayload, warningsPayload] = anyPortuguese
    ? await Promise.all([fetchJson(IPMA_LOCATIONS), fetchJson(IPMA_WARNINGS)])
    : [null, null];
  const locations = parseIpmaLocations(locationsPayload);

  // One request per forecast point, however many games it covers.
  const ipmaForecasts = new Map<number, Promise<unknown>>();
  const metForecasts = new Map<string, Promise<unknown>>();

  const results = new Map<string, { weather: KickoffWeather; warning: Warning | null; venue: Venue }>();
  for (const fixture of fixtures) {
    const venue = venues.get(fixture.venue_id);
    if (!venue || venue.latitude === null || venue.longitude === null) {
      summary.missing += 1;
      continue;
    }
    const ipma: IpmaLocation | null =
      venue.country === 'Portugal' ? nearestIpmaLocation(locations, venue.latitude, venue.longitude) : null;

    let weather: KickoffWeather | null = null;
    let warning: Warning | null = null;
    if (ipma) {
      if (!ipmaForecasts.has(ipma.id)) ipmaForecasts.set(ipma.id, fetchJson(`${IPMA_FORECAST}/${ipma.id}.json`));
      weather = ipmaKickoffWeather(
        await ipmaForecasts.get(ipma.id),
        fixture.kickoff_at,
        venue.latitude,
        venue.longitude
      );
      warning = ipmaWarning(warningsPayload, ipma.warningArea, fixture.kickoff_at);
    }
    if (!weather) {
      // Abroad, and in Portugal when IPMA has nothing usable. MET asks for at most 4 decimals.
      const key = `lat=${venue.latitude.toFixed(4)}&lon=${venue.longitude.toFixed(4)}`;
      if (!metForecasts.has(key)) metForecasts.set(key, fetchJson(`${MET_FORECAST}?${key}`));
      weather = metKickoffWeather(await metForecasts.get(key), fixture.kickoff_at);
    }
    if (!weather) {
      // Keep the last forecast saved, if any, rather than none.
      summary.missing += 1;
      continue;
    }
    results.set(fixture.id, { weather, warning, venue });
  }

  const rows = [...results.entries()].map(([fixtureId, { weather, warning }]) => ({
    fixture_id: fixtureId,
    source: weather.source,
    forecast_for: weather.forecastFor,
    condition: weather.condition,
    temperature_c: weather.temperatureC,
    rain_probability: weather.rainProbability,
    wind_kmh: weather.windKmh,
    warning_level: warning?.level ?? null,
    warning_kind: warning?.kind ?? null,
    updated_at: new Date(now).toISOString(),
  }));
  if (rows.length > 0) {
    const { error } = await admin.from('fixture_weather').upsert(rows, { onConflict: 'fixture_id' });
    if (error) {
      console.error('sync-weather upsert failed:', error.message);
      return json(500, { error: 'upsert_failed' });
    }
    summary.forecasts = rows.length;
  }

  // The push, about 3 hours before kick-off.
  const notices = new Map<string, { title: string; body: string }>();
  for (const fixture of fixtures) {
    const kickoff = Date.parse(fixture.kickoff_at);
    const result = results.get(fixture.id);
    if (!result || kickoff - now <= NOTICE_FROM_MS || kickoff - now > NOTICE_TO_MS) continue;
    const notice = weatherNotice({
      weather: result.weather,
      warning: result.warning,
      roof: result.venue.roof_coverage,
      venueName: result.venue.name,
      kickoffAt: fixture.kickoff_at,
    });
    if (notice) notices.set(fixture.id, notice);
  }

  await admin.from('weather_notice').delete().lt('sent_at', new Date(now - NOTICE_KEEP_MS).toISOString());
  if (notices.size === 0) return json(200, summary);

  const fixtureIds = [...notices.keys()];
  const [going, alreadySent] = await Promise.all([
    admin.from('fixture_attendance').select('profile_id, fixture_id').eq('status', 'going').in('fixture_id', fixtureIds),
    admin.from('weather_notice').select('profile_id, fixture_id').in('fixture_id', fixtureIds),
  ]);
  if (going.error || alreadySent.error) return json(500, { error: 'attendance_failed' });
  const sent = new Set((alreadySent.data ?? []).map((row) => `${row.profile_id}|${row.fixture_id}`));
  const pending = (going.data ?? []).filter((row) => !sent.has(`${row.profile_id}|${row.fixture_id}`));
  if (pending.length === 0) return json(200, summary);

  const people = [...new Set(pending.map((row) => String(row.profile_id)))];
  const turnedOff = await admin
    .from('notification_preference')
    .select('profile_id')
    .eq('kind', 'weather')
    .eq('enabled', false)
    .in('profile_id', people);
  const off = new Set((turnedOff.data ?? []).map((row) => String(row.profile_id)));
  const recipients = pending.filter((row) => !off.has(String(row.profile_id)));
  if (recipients.length === 0) return json(200, summary);

  // Recorded before sending: a failed push is not retried, two pushes for the same game would be worse.
  const recorded = await admin.from('weather_notice').upsert(
    recipients.map((row) => ({ profile_id: row.profile_id, fixture_id: row.fixture_id })),
    { onConflict: 'profile_id,fixture_id', ignoreDuplicates: true }
  );
  if (recorded.error) return json(500, { error: 'notice_record_failed' });
  summary.notices = recipients.length;

  const tokens = await admin
    .from('device_token')
    .select('token, profile_id')
    .in('profile_id', [...new Set(recipients.map((row) => String(row.profile_id)))]);
  const tokensByProfile = new Map<string, string[]>();
  for (const row of tokens.data ?? []) {
    const list = tokensByProfile.get(String(row.profile_id)) ?? [];
    list.push(String(row.token));
    tokensByProfile.set(String(row.profile_id), list);
  }
  const messages = recipients.flatMap((row) => {
    const notice = notices.get(String(row.fixture_id));
    if (!notice) return [];
    return (tokensByProfile.get(String(row.profile_id)) ?? []).map((token) => ({
      to: token,
      title: notice.title,
      body: notice.body,
      data: { type: 'weather', fixtureId: String(row.fixture_id) },
    }));
  });
  for (let start = 0; start < messages.length; start += 100) {
    const outcome = await sendExpoPush(messages.slice(start, start + 100));
    summary.pushed += outcome.sent;
    if (outcome.invalidTokens.length > 0) {
      await admin.from('device_token').delete().in('token', outcome.invalidTokens);
    }
  }

  return json(200, summary);
});
