// Daily push from the coach. pg_cron calls this every hour with a secret header; it only works at 10:00 in
// Lisbon. Candidates come from SQL (coach_push_candidates): users who want suggestions, have a phone
// registered, got no message in the last 6 hours and have a context worth a message. No context, no push:
// it never sends "nothing new". A context that already has a message (seen in the app or pushed) is skipped.

import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

import { parseCoachResult, type CoachContext } from '../_shared/coach-context.ts';
import { writeCoachMessage } from '../_shared/coach-writer.ts';
import { sendExpoPush } from '../_shared/expo-push.ts';
import { lisbonDay, lisbonHour } from '../_shared/portuguese.ts';

const PUSH_HOUR_IN_LISBON = 10;
const MAX_PUSHES_PER_RUN = 1000;
const PARALLEL_USERS = 5;

type Candidate = { profileId: string; context: CoachContext };

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
    const context = parseCoachResult(fields?.context)?.context;
    return typeof profileId === 'string' && context ? [{ profileId, context }] : [];
  });
}

function strings(rows: unknown, key: string) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => asRecord(row)?.[key]).filter((value): value is string => typeof value === 'string');
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
  if (!force && lisbonHour(now) !== PUSH_HOUR_IN_LISBON) {
    return json(200, { skipped: 'not the push hour in Lisbon' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json(500, { error: 'misconfigured' });
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const run = await admin.from('ai_run').insert({ job: 'nudges' }).select('id').single();
  const runId = asRecord(run.data)?.id;

  const { data: candidateRows, error: candidatesError } = await admin.rpc('coach_push_candidates', {
    p_now: now.toISOString(),
  });
  if (candidatesError) return json(500, { error: 'candidates_failed' });

  const candidates = parseCandidates(candidateRows)
    .filter((candidate) => !onlyProfiles || onlyProfiles.includes(candidate.profileId))
    .slice(0, MAX_PUSHES_PER_RUN);

  const summary = {
    candidates: candidates.length,
    already_delivered: 0,
    created: 0,
    from_model: 0,
    from_template: 0,
    pushed: 0,
    errors: 0,
    input_tokens: 0,
    output_tokens: 0,
  };

  async function handle({ profileId, context }: Candidate) {
    const existing = await admin
      .from('nudge')
      .select('id')
      .eq('profile_id', profileId)
      .eq('context_key', context.contextKey)
      .maybeSingle();
    if (existing.error) {
      summary.errors += 1;
      return;
    }
    if (existing.data) {
      summary.already_delivered += 1;
      return;
    }

    const written = await writeCoachMessage(admin, profileId, context, now);
    if (!written) {
      summary.errors += 1;
      return;
    }
    summary.input_tokens += written.inputTokens;
    summary.output_tokens += written.outputTokens;

    const inserted = await admin
      .from('nudge')
      .insert({
        profile_id: profileId,
        kind: context.kind,
        fixture_id: context.fixtureId,
        context_key: context.contextKey,
        local_date: lisbonDay(now),
        facts: context.facts,
        body: written.body,
        source: written.source,
        model: written.model,
        input_tokens: written.inputTokens,
        output_tokens: written.outputTokens,
      })
      .select('id')
      .single();
    // 23505: the app saved this context in the meantime. Nothing to push.
    if (inserted.error) {
      if (inserted.error.code === '23505') summary.already_delivered += 1;
      else summary.errors += 1;
      return;
    }
    const nudgeId = asRecord(inserted.data)?.id;
    if (typeof nudgeId !== 'string') return;

    summary.created += 1;
    if (written.source === 'model') summary.from_model += 1;
    else summary.from_template += 1;

    const tokens = await admin.from('device_token').select('token').eq('profile_id', profileId);
    const deviceTokens = strings(tokens.data, 'token');
    if (deviceTokens.length === 0) {
      await admin.from('nudge').update({ push_status: 'no_device' }).eq('id', nudgeId);
      return;
    }

    const outcome = await sendExpoPush(
      deviceTokens.map((to) => ({ to, title: 'AwayDay', body: written.body, data: { type: 'nudge', nudgeId } }))
    );
    if (outcome.invalidTokens.length > 0) {
      await admin.from('device_token').delete().in('token', outcome.invalidTokens);
    }
    await admin
      .from('nudge')
      .update({ push_status: outcome.sent > 0 ? 'sent' : 'failed' })
      .eq('id', nudgeId);
    if (outcome.sent > 0) {
      summary.pushed += 1;
      await admin.from('coach_state').upsert({ profile_id: profileId, last_message_at: now.toISOString() });
    }
  }

  for (let start = 0; start < candidates.length; start += PARALLEL_USERS) {
    await Promise.all(candidates.slice(start, start + PARALLEL_USERS).map(handle));
  }

  if (typeof runId === 'number') {
    const { already_delivered: _alreadyDelivered, ...counts } = summary;
    await admin
      .from('ai_run')
      .update({ ...counts, finished_at: new Date().toISOString() })
      .eq('id', runId);
  }

  return json(200, summary);
});
