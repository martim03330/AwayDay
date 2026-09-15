import { FunctionsHttpError } from '@supabase/supabase-js';

import {
  DraftRefused,
  type DraftFields,
  type MeetingPointDraft,
} from '@/features/meeting-points/types';
import { supabase } from '@/lib/supabase';

// Meeting point drafts: only admins can read them (RLS) and decide on them (meeting-point-drafts function).

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

export async function fetchPendingDrafts(): Promise<MeetingPointDraft[]> {
  const { data, error } = await client()
    .from('meeting_point_draft')
    .select('id, fixture_id, club_id, source_url, source_title, excerpt, found_at')
    .eq('status', 'pending')
    .order('found_at', { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    fixtureId: row.fixture_id,
    clubId: row.club_id,
    sourceUrl: row.source_url,
    sourceTitle: row.source_title,
    excerpt: row.excerpt,
    foundAt: row.found_at,
  }));
}

async function draftError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const response: unknown = error.context;
    let code: unknown = null;
    if (response instanceof Response) {
      try {
        code = asRecord(await response.json())?.error;
      } catch {
        code = null;
      }
    }
    if (code === 'invalid_fields') return new DraftRefused('invalid-fields');
    if (code === 'already_decided') return new DraftRefused('already-decided');
    if (code === 'not_admin') return new DraftRefused('not-admin');
  }
  return error instanceof Error ? error : new Error('Draft decision failed.');
}

/** Publishes the meeting point. `located`: whether the place was found on the map. */
export async function approveDraft(draftId: string, fields: DraftFields) {
  const { data, error } = await client().functions.invoke<unknown>('meeting-point-drafts', {
    method: 'POST',
    body: { action: 'approve', draftId, ...fields },
  });
  if (error) throw await draftError(error);
  return { located: asRecord(data)?.located === true };
}

export async function dismissDraft(draftId: string) {
  const { error } = await client().functions.invoke<unknown>('meeting-point-drafts', {
    method: 'POST',
    body: { action: 'dismiss', draftId },
  });
  if (error) throw await draftError(error);
}
