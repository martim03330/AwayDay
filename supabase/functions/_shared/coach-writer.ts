// Writes the sentence for a coach context. Templates by default (free). Claude only when ANTHROPIC_API_KEY
// and AI_MONTHLY_BUDGET_USD are set, the month's budget is not spent and the user is under the monthly cap;
// if the model fails or breaks a rule, the template is used. Shared by coach-message and generate-nudges.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';

import { monthlyAiUsage } from './ai-budget.ts';
import { NUDGE_MODEL, writeNudgeWithClaude } from './anthropic.ts';
import type { CoachContext } from './coach-context.ts';
import { buildSlots } from './nudge-slots.ts';
import { acceptModelNudge, seedFrom, templateIdFor, templateNudge } from './nudge-text.ts';

/** Model calls per user per month; after that, templates. */
export const MAX_MODEL_CALLS_PER_USER_PER_MONTH = 40;

export type WrittenMessage = {
  body: string;
  source: 'model' | 'template';
  model: string | null;
  inputTokens: number;
  outputTokens: number;
};

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

/** The API key when the model may be used for this user now; otherwise `null`. */
async function modelKeyFor(admin: SupabaseClient, profileId: string, now: Date) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  const budget = Number(Deno.env.get('AI_MONTHLY_BUDGET_USD') ?? '0');
  if (!apiKey || !(budget > 0)) return null;

  const usage = await monthlyAiUsage(admin, now, profileId);
  if (!usage) return null;
  return usage.spentUsd < budget && usage.profileModelMessages < MAX_MODEL_CALLS_PER_USER_PER_MONTH ? apiKey : null;
}

/** Catalogue names: the model may never type them, only use slots. */
async function catalogueNames(admin: SupabaseClient) {
  const [venues, clubs, places] = await Promise.all([
    admin.from('venue').select('name, short_name'),
    admin.from('club').select('short_name'),
    admin.from('place').select('name'),
  ]);
  return [
    ...strings(venues.data, ['name', 'short_name']),
    ...strings(clubs.data, ['short_name']),
    ...strings(places.data, ['name']),
  ];
}

/** The message for a context, or `null` when its facts are incomplete. */
export async function writeCoachMessage(
  admin: SupabaseClient,
  profileId: string,
  context: CoachContext,
  now: Date
): Promise<WrittenMessage | null> {
  const slots = buildSlots(context.kind, context.facts);
  if (!slots) return null;
  const templateId = templateIdFor(context.kind, context.facts);
  const template = templateNudge(templateId, slots, seedFrom(`${profileId}:${context.contextKey}`));

  const apiKey = await modelKeyFor(admin, profileId, now);
  if (apiKey) {
    const written = await writeNudgeWithClaude(apiKey, templateId, slots);
    const body = acceptModelNudge(templateId, written.template, slots, await catalogueNames(admin));
    // Tokens are recorded even when the sentence is refused, so the budget counts them.
    const usage = { inputTokens: written.inputTokens, outputTokens: written.outputTokens };
    if (body) return { body, source: 'model', model: NUDGE_MODEL, ...usage };
    return template ? { body: template, source: 'template', model: null, ...usage } : null;
  }

  return template ? { body: template, source: 'template', model: null, inputTokens: 0, outputTokens: 0 } : null;
}
