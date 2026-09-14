// The coach message for whoever opens the app. The context (facts and key) comes from SQL, in
// coach_context; the sentence from coach-writer. One message per context: asking again with the same context
// returns the saved message and writes nothing new. Nothing worth saying: `message: null`.
// verify_jwt is off (it also works with the new API keys); the caller is checked with authenticatedCaller.

import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

import { authenticatedCaller } from '../_shared/auth.ts';
import { contextInstant, parseCoachResult } from '../_shared/coach-context.ts';
import { writeCoachMessage } from '../_shared/coach-writer.ts';
import { lisbonDay } from '../_shared/portuguese.ts';

/** New messages per user per hour. Saved messages do not count: they are returned without writing anything. */
const NEW_MESSAGES_PER_HOUR = 12;

type SavedMessage = { id: string; body: string };

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

function savedMessage(row: unknown): SavedMessage | null {
  const fields = asRecord(row);
  return typeof fields?.id === 'string' && typeof fields.body === 'string'
    ? { id: fields.id, body: fields.body }
    : null;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json(500, { error: 'misconfigured' });
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const caller = await authenticatedCaller(request, admin);
  if (!caller) return json(401, { error: 'not_authenticated' });
  const profileId = caller.user.id;

  const options = asRecord(await request.json().catch(() => null));
  const realNow = new Date();
  // Demo mode moves the app's clock (up to 60 days either way); it only changes this user's own messages, and new
  // messages stay under the hourly limit below whatever clock the app sends.
  const now = contextInstant(options?.now, realNow);

  const profile = await admin.from('profile').select('nudges_enabled').eq('id', profileId).maybeSingle();
  if (profile.error) return json(500, { error: 'profile_failed' });
  if (asRecord(profile.data)?.nudges_enabled !== true) return json(200, { message: null });

  const context = await admin.rpc('coach_context', { p_profile_id: profileId, p_now: now.toISOString() });
  const result = context.error ? null : parseCoachResult(context.data);
  if (!result) return json(500, { error: 'context_failed' });

  const current = result.context;
  let message: SavedMessage | null = null;

  if (current) {
    const findSaved = async () => {
      const saved = await admin
        .from('nudge')
        .select('id, body')
        .eq('profile_id', profileId)
        .eq('context_key', current.contextKey)
        .maybeSingle();
      return savedMessage(saved.data);
    };

    message = await findSaved();
    if (!message) {
      // A new message is a write and may be a model call. The limit holds for parallel requests too.
      const allowed = await admin.rpc('take_rate_limit', {
        p_profile_id: profileId,
        p_bucket: 'coach-message',
        p_limit: NEW_MESSAGES_PER_HOUR,
        p_window: '1 hour',
      });
      if (allowed.error) return json(500, { error: 'rate_limit_failed' });
      if (allowed.data !== true) return json(429, { error: 'rate_limited' });

      const written = await writeCoachMessage(admin, profileId, current, realNow);
      if (written) {
        const inserted = await admin
          .from('nudge')
          .insert({
            profile_id: profileId,
            kind: current.kind,
            fixture_id: current.fixtureId,
            context_key: current.contextKey,
            local_date: lisbonDay(now),
            facts: current.facts,
            body: written.body,
            source: written.source,
            model: written.model,
            input_tokens: written.inputTokens,
            output_tokens: written.outputTokens,
            push_status: 'in_app',
            read_at: realNow.toISOString(),
          })
          .select('id, body')
          .single();
        // 23505: another request saved this context first; use that one.
        if (!inserted.error) message = savedMessage(inserted.data);
        else if (inserted.error.code === '23505') message = await findSaved();
        else console.error('coach-message insert failed:', inserted.error.code);
      }
    }

    // Shown in the app counts as read in Novidades (e.g. a pushed message opened later).
    if (message) {
      await admin.from('nudge').update({ read_at: realNow.toISOString() }).eq('id', message.id).is('read_at', null);
    }
  }

  const state = await admin.from('coach_state').upsert({
    profile_id: profileId,
    last_opened_at: realNow.toISOString(),
    last_passport_count: result.passportCount,
    ...(message ? { last_message_at: realNow.toISOString() } : {}),
  });
  if (state.error) console.error('coach-message state failed:', state.error.code);

  return json(200, {
    message: message && current ? { id: message.id, body: message.body, kind: current.kind } : null,
  });
});
