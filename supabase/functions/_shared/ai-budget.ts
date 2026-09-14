// What the model cost this month, to keep it under AI_MONTHLY_BUDGET_USD. Summed in SQL (ai_usage_since): reading
// the rows through the API stops at 1000 and would undercount. Coach messages and season recaps share the budget.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';

import { NUDGE_MODEL_PRICE } from './anthropic.ts';
import { RECAP_MODEL_PRICE } from './recap-model.ts';

export type AiUsage = {
  /** USD spent on the model since the start of the month (UTC). */
  spentUsd: number;
  /** Coach messages the model wrote for the user asked about. */
  profileModelMessages: number;
};

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/** Reads what ai_usage_since returns; `null` when it is malformed. Pure and testable. */
export function parseAiUsage(value: unknown): AiUsage | null {
  const fields = asRecord(value);
  if (!fields) return null;
  const nudgeInput = count(fields.nudge_input_tokens);
  const nudgeOutput = count(fields.nudge_output_tokens);
  const recapInput = count(fields.recap_input_tokens);
  const recapOutput = count(fields.recap_output_tokens);
  const profileModelMessages = count(fields.profile_model_messages);
  if (
    nudgeInput === null ||
    nudgeOutput === null ||
    recapInput === null ||
    recapOutput === null ||
    profileModelMessages === null
  ) {
    return null;
  }

  const spentUsd =
    (nudgeInput * NUDGE_MODEL_PRICE.input +
      nudgeOutput * NUDGE_MODEL_PRICE.output +
      recapInput * RECAP_MODEL_PRICE.input +
      recapOutput * RECAP_MODEL_PRICE.output) /
    1_000_000;
  return { spentUsd, profileModelMessages };
}

/** Usage since the start of this month (UTC). `null` when it cannot be read: then the model stays off. */
export async function monthlyAiUsage(
  admin: SupabaseClient,
  now: Date,
  profileId: string | null
): Promise<AiUsage | null> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const { data, error } = await admin
    .rpc('ai_usage_since', { p_since: monthStart.toISOString(), p_profile_id: profileId })
    .single();
  return error ? null : parseAiUsage(data);
}
