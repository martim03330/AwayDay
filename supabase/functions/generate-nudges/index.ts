// Daily match-day suggestions. pg_cron calls this every hour with a secret header; it only works at
// 10:00 in Lisbon. Facts come from SQL (nudge_candidates); the sentence comes from a template, or from
// Claude when ANTHROPIC_API_KEY and AI_MONTHLY_BUDGET_USD are set. Then it saves the nudge (at most one
// per user per day, enforced by the database) and sends a push to the user's devices.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { NUDGE_MODEL, NUDGE_MODEL_PRICE, writeNudgeWithClaude } from '../_shared/anthropic.ts';
import { sendExpoPush } from '../_shared/expo-push.ts';
import { buildSlots, isNudgeKind, type NudgeKind } from '../_shared/nudge-slots.ts';
import { acceptModelNudge, seedFrom, templateNudge } from '../_shared/nudge-text.ts';
import { lisbonDay, lisbonHour } from '../_shared/portuguese.ts';

const NUDGE_HOUR_IN_LISBON = 10;
const MAX_NUDGES_PER_RUN = 1000;
const PARALLEL_USERS = 5;

type Candidate = { profileId: string; kind: NudgeKind; fixtureId: string | null; facts: unknown };

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

function sameSecret(expected: string, provided: string) {
  if (expected.length !== provided.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return difference === 0;
}

function parseCandidates(data: unknown): Candidate[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const fields = asRecord(row);
    const profileId = fields?.profile_id;
    const kind = fields?.kind;
    const fixtureId = fields?.fixture_id;
    if (typeof profileId !== 'string' || !isNudgeKind(kind)) return [];
    return [{
      profileId,
      kind,
      fixtureId: typeof fixtureId === 'string' ? fixtureId : null,
      facts: fields?.facts,
    }];
  });
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

  const cronSecret = Deno.env.get('CRON_SECRET');
  const providedSecret = request.headers.get('x-cron-secret') ?? '';
  if (!cronSecret || !sameSecret(cronSecret, providedSecret)) return json(401, { error: 'unauthorized' });

  const options = asRecord(await request.json().catch(() => null));
  // `force` skips the 10:00 check; `profile_ids` limits a run to some users. Both only for tests.
  const force = options?.force === true;
  const onlyProfiles = Array.isArray(options?.profile_ids)
    ? options.profile_ids.filter((id): id is string => typeof id === 'string')
    : null;

  const now = new Date();
  if (!force && lisbonHour(now) !== NUDGE_HOUR_IN_LISBON) {
    return json(200, { skipped: 'not the nudge hour in Lisbon' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json(500, { error: 'misconfigured' });
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const run = await admin.from('ai_run').insert({ job: 'nudges' }).select('id').single();
  const runId = asRecord(run.data)?.id;

  const { data: candidateRows, error: candidatesError } = await admin.rpc('nudge_candidates', {
    p_now: now.toISOString(),
  });
  if (candidatesError) return json(500, { error: 'candidates_failed' });

  const candidates = parseCandidates(candidateRows)
    .filter((candidate) => !onlyProfiles || onlyProfiles.includes(candidate.profileId))
    .slice(0, MAX_NUDGES_PER_RUN);

  // Catalogue names: the model may never type them, only use slots.
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

  // The model is off unless a key and a budget are set. Spending is tracked from saved nudges.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  const monthlyBudget = Number(Deno.env.get('AI_MONTHLY_BUDGET_USD') ?? '0');
  const today = lisbonDay(now);
  let spentThisMonth = 0;
  if (apiKey && monthlyBudget > 0) {
    const usage = await admin
      .from('nudge')
      .select('input_tokens, output_tokens')
      .eq('source', 'model')
      .gte('local_date', `${today.slice(0, 7)}-01`);
    for (const row of Array.isArray(usage.data) ? usage.data : []) {
      const fields = asRecord(row);
      spentThisMonth +=
        (Number(fields?.input_tokens ?? 0) * NUDGE_MODEL_PRICE.input +
          Number(fields?.output_tokens ?? 0) * NUDGE_MODEL_PRICE.output) /
        1_000_000;
    }
  }

  const summary = {
    candidates: candidates.length,
    created: 0,
    from_model: 0,
    from_template: 0,
    pushed: 0,
    errors: 0,
    input_tokens: 0,
    output_tokens: 0,
  };

  async function handle(candidate: Candidate) {
    const slots = buildSlots(candidate.kind, candidate.facts, now);
    if (!slots) {
      summary.errors += 1;
      return;
    }

    let body: string | null = null;
    let source: 'model' | 'template' = 'template';
    let inputTokens = 0;
    let outputTokens = 0;

    if (apiKey && spentThisMonth < monthlyBudget) {
      const written = await writeNudgeWithClaude(apiKey, candidate.kind, slots);
      inputTokens = written.inputTokens;
      outputTokens = written.outputTokens;
      spentThisMonth +=
        (inputTokens * NUDGE_MODEL_PRICE.input + outputTokens * NUDGE_MODEL_PRICE.output) / 1_000_000;
      body = acceptModelNudge(candidate.kind, written.template, slots, catalogueNames);
      if (body) source = 'model';
    }

    body ??= templateNudge(candidate.kind, slots, seedFrom(`${candidate.profileId}:${today}`));
    if (!body) {
      summary.errors += 1;
      return;
    }

    const inserted = await admin
      .from('nudge')
      .insert({
        profile_id: candidate.profileId,
        kind: candidate.kind,
        fixture_id: candidate.fixtureId,
        local_date: today,
        facts: candidate.facts,
        body,
        source,
        model: source === 'model' ? NUDGE_MODEL : null,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      })
      .select('id')
      .single();
    summary.input_tokens += inputTokens;
    summary.output_tokens += outputTokens;
    // 23505: this user already has today's nudge (e.g. the job ran twice). Nothing else to do.
    if (inserted.error) {
      if (inserted.error.code !== '23505') summary.errors += 1;
      return;
    }
    const nudgeId = asRecord(inserted.data)?.id;
    if (typeof nudgeId !== 'string') return;

    summary.created += 1;
    if (source === 'model') summary.from_model += 1;
    else summary.from_template += 1;

    const tokens = await admin.from('device_token').select('token').eq('profile_id', candidate.profileId);
    const deviceTokens = strings(tokens.data, ['token']);
    if (deviceTokens.length === 0) {
      await admin.from('nudge').update({ push_status: 'no_device' }).eq('id', nudgeId);
      return;
    }

    const outcome = await sendExpoPush(
      deviceTokens.map((to) => ({ to, title: 'AwayDay', body, data: { type: 'nudge', nudgeId } }))
    );
    if (outcome.invalidTokens.length > 0) {
      await admin.from('device_token').delete().in('token', outcome.invalidTokens);
    }
    await admin
      .from('nudge')
      .update({ push_status: outcome.sent > 0 ? 'sent' : 'failed' })
      .eq('id', nudgeId);
    if (outcome.sent > 0) summary.pushed += 1;
  }

  for (let start = 0; start < candidates.length; start += PARALLEL_USERS) {
    await Promise.all(candidates.slice(start, start + PARALLEL_USERS).map(handle));
  }

  if (typeof runId === 'number') {
    await admin
      .from('ai_run')
      .update({ ...summary, finished_at: new Date().toISOString() })
      .eq('id', runId);
  }

  return json(200, summary);
});
