// Season recaps. pg_cron calls this once a day from 15 to 20 June with a secret header. For each user who
// wants one and did something that season, the numbers come from SQL (season_recap_stats); the text comes
// from templates, or from Claude when ANTHROPIC_API_KEY and AI_MONTHLY_BUDGET_USD are set. One recap per
// user per season (enforced by the database), then a push to the user's devices.

import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

import { monthlyAiUsage } from '../_shared/ai-budget.ts';
import { hasCronSecret } from '../_shared/auth.ts';
import { sendExpoPush } from '../_shared/expo-push.ts';
import { lisbonDay } from '../_shared/portuguese.ts';
import { RECAP_MODEL, RECAP_MODEL_PRICE, writeRecapWithClaude } from '../_shared/recap-model.ts';
import {
  acceptModelRecap,
  parseRecapStats,
  recapSeed,
  recapSlots,
  seasonLabel,
  templateRecap,
} from '../_shared/recap-text.ts';

const MAX_RECAPS_PER_RUN = 2000;
const PARALLEL_USERS = 5;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function strings(rows: unknown, keys: readonly string[]) {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const fields = asRecord(row);
    return keys.map((key) => fields?.[key]).filter((value): value is string => typeof value === 'string');
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!hasCronSecret(request)) return json(401, { error: 'unauthorized' });

  const options = asRecord(await request.json().catch(() => null));
  // For tests only (still behind the secret): run outside June, for one season, for some users.
  const force = options?.force === true;
  const onlyProfiles = Array.isArray(options?.profile_ids)
    ? options.profile_ids.filter((id): id is string => typeof id === 'string')
    : null;

  const now = new Date();
  const today = lisbonDay(now);
  const [, month = '', day = ''] = today.split('-');
  if (!force && !(month === '06' && Number(day) >= 15 && Number(day) <= 20)) {
    return json(200, { skipped: 'season recaps run from 15 to 20 June' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json(500, { error: 'misconfigured' });
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // The season that contains today (in June, the one that is ending), unless a test names one.
  let seasonId = typeof options?.season_id === 'string' ? options.season_id : null;
  if (!seasonId) {
    const season = await admin
      .from('season')
      .select('id')
      .lte('starts_on', today)
      .gte('ends_on', today)
      .maybeSingle();
    seasonId = typeof asRecord(season.data)?.id === 'string' ? String(asRecord(season.data)?.id) : null;
  }
  if (!seasonId) return json(200, { skipped: 'no season today' });

  const run = await admin.from('ai_run').insert({ job: 'season_recap' }).select('id').single();
  const runId = asRecord(run.data)?.id;

  const { data: candidateRows, error: candidatesError } = await admin.rpc('season_recap_candidates', {
    p_season_id: seasonId,
  });
  if (candidatesError) return json(500, { error: 'candidates_failed' });
  const profileIds = strings(candidateRows, ['profile_id'])
    .filter((id) => !onlyProfiles || onlyProfiles.includes(id))
    .slice(0, MAX_RECAPS_PER_RUN);

  const [venues, clubs, places] = await Promise.all([
    admin.from('venue').select('name, short_name'),
    admin.from('club').select('short_name'),
    admin.from('place').select('name'),
  ]);
  const catalogueNames = [
    ...strings(venues.data, ['name', 'short_name']),
    ...strings(clubs.data, ['short_name']),
    ...strings(places.data, ['name']),
  ];

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  const monthlyBudget = Number(Deno.env.get('AI_MONTHLY_BUDGET_USD') ?? '0');
  // Starts from what the month already spent, coach messages included: every run shares one monthly budget.
  // If the usage cannot be read, the model stays off.
  const usage = apiKey ? await monthlyAiUsage(admin, now, null) : null;
  let spent = usage?.spentUsd ?? Number.POSITIVE_INFINITY;

  const summary = {
    candidates: profileIds.length,
    created: 0,
    from_model: 0,
    from_template: 0,
    pushed: 0,
    errors: 0,
    input_tokens: 0,
    output_tokens: 0,
  };

  async function handle(profileId: string) {
    const statsResult = await admin.rpc('season_recap_stats', { p_profile_id: profileId, p_season_id: seasonId });
    const stats = parseRecapStats(statsResult.data);
    if (statsResult.error || !stats) {
      summary.errors += 1;
      return;
    }

    let text = null as ReturnType<typeof templateRecap> | null;
    let source: 'model' | 'template' = 'template';
    let inputTokens = 0;
    let outputTokens = 0;

    if (apiKey && spent < monthlyBudget) {
      const written = await writeRecapWithClaude(apiKey, recapSlots(stats));
      inputTokens = written.inputTokens;
      outputTokens = written.outputTokens;
      spent += (inputTokens * RECAP_MODEL_PRICE.input + outputTokens * RECAP_MODEL_PRICE.output) / 1_000_000;
      text = acceptModelRecap(written.written, stats, catalogueNames);
      if (text) source = 'model';
    }
    text ??= templateRecap(stats, recapSeed(profileId, stats.seasonId));

    const inserted = await admin
      .from('season_recap')
      .insert({
        profile_id: profileId,
        season_id: stats.seasonId,
        stats: statsResult.data,
        headline: text.headline,
        body: text.body,
        source,
        model: source === 'model' ? RECAP_MODEL : null,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      })
      .select('id')
      .single();
    summary.input_tokens += inputTokens;
    summary.output_tokens += outputTokens;
    if (inserted.error) {
      if (inserted.error.code !== '23505') summary.errors += 1;
      return;
    }
    const recapId = asRecord(inserted.data)?.id;
    if (typeof recapId !== 'string') return;
    summary.created += 1;
    if (source === 'model') summary.from_model += 1;
    else summary.from_template += 1;

    const tokens = await admin.from('device_token').select('token').eq('profile_id', profileId);
    const deviceTokens = strings(tokens.data, ['token']);
    if (deviceTokens.length === 0) {
      await admin.from('season_recap').update({ push_status: 'no_device' }).eq('id', recapId);
      return;
    }
    const outcome = await sendExpoPush(
      deviceTokens.map((to) => ({
        to,
        title: 'AwayDay',
        body: `A tua época ${seasonLabel(stats.seasonId)} está pronta. Vem ver os números.`,
        data: { type: 'recap', recapId },
      }))
    );
    if (outcome.invalidTokens.length > 0) await admin.from('device_token').delete().in('token', outcome.invalidTokens);
    await admin.from('season_recap').update({ push_status: outcome.sent > 0 ? 'sent' : 'failed' }).eq('id', recapId);
    if (outcome.sent > 0) summary.pushed += 1;
  }

  for (let start = 0; start < profileIds.length; start += PARALLEL_USERS) {
    await Promise.all(profileIds.slice(start, start + PARALLEL_USERS).map(handle));
  }

  if (typeof runId === 'number') {
    await admin.from('ai_run').update({ ...summary, finished_at: new Date().toISOString() }).eq('id', runId);
  }
  return json(200, { season_id: seasonId, ...summary });
});
