// Reads what coach_context (SQL) returns and the instant the app asks about. Pure and testable.

import { isNudgeKind, type NudgeKind } from './nudge-slots.ts';

export type CoachContext = {
  kind: NudgeKind;
  fixtureId: string | null;
  /** One message per user per key: while it stays the same, the saved message is reused. */
  contextKey: string;
  facts: unknown;
};

export type CoachResult = {
  /** Different stadiums attended, stored to spot a milestone reached before the next ask. */
  passportCount: number;
  /** `null`: nothing worth saying. */
  context: CoachContext | null;
};

/** How far the app may move the clock (demo mode), in either direction. */
export const MAX_CLOCK_SHIFT_MS = 60 * 24 * 60 * 60 * 1000;

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

/** `null` when the result is malformed. */
export function parseCoachResult(value: unknown): CoachResult | null {
  const fields = asRecord(value);
  const passportCount = fields?.passport_count;
  if (!fields || typeof passportCount !== 'number' || !Number.isInteger(passportCount) || passportCount < 0) {
    return null;
  }
  if (fields.kind === null || fields.kind === undefined) return { passportCount, context: null };

  const contextKey = fields.context_key;
  if (!isNudgeKind(fields.kind) || typeof contextKey !== 'string' || contextKey.length === 0) return null;
  return {
    passportCount,
    context: {
      kind: fields.kind,
      fixtureId: typeof fields.fixture_id === 'string' ? fields.fixture_id : null,
      contextKey,
      facts: fields.facts,
    },
  };
}

/** The instant the app sent (demo mode moves it), or the real one when it is missing or too far off. */
export function contextInstant(value: unknown, realNow: Date): Date {
  if (typeof value !== 'string') return realNow;
  const time = new Date(value).getTime();
  return Number.isNaN(time) || Math.abs(time - realNow.getTime()) > MAX_CLOCK_SHIFT_MS ? realNow : new Date(time);
}
