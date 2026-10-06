import {
  REPORT_REASONS,
  type BlockedPerson,
  type PendingReport,
  type ReportAction,
  type ReportKind,
  type ReportReason,
} from '@/features/moderation/types';
import { supabase } from '@/lib/supabase';

// Reporting and blocking (App Store guideline 1.2). Everything goes through server functions: the server checks the
// reporter can see what they report, rate-limits them, and keeps blocks invisible to the person blocked.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type ModerationRefusal =
  | 'not_signed_in'
  | 'not_found'
  | 'own_content'
  | 'no_photo'
  | 'bad_reason'
  | 'bad_note'
  | 'bad_request'
  | 'rate_limited'
  | 'not_admin'
  | 'unknown';

export class ModerationRefused extends Error {
  readonly reason: ModerationRefusal;

  constructor(reason: ModerationRefusal) {
    super(reason);
    this.name = 'ModerationRefused';
    this.reason = reason;
  }
}

const RECUSAS: ModerationRefusal[] = [
  'not_signed_in',
  'not_found',
  'own_content',
  'no_photo',
  'bad_reason',
  'bad_note',
  'bad_request',
  'rate_limited',
  'not_admin',
];

function refusal(error: { message: string }) {
  return new ModerationRefused(RECUSAS.find((reason) => error.message === reason) ?? 'unknown');
}

const KINDS: ReportKind[] = ['message', 'ride_message', 'profile', 'profile_photo', 'group'];

function reportKind(value: string): ReportKind {
  return KINDS.find((kind) => kind === value) ?? 'profile';
}

function reportReason(value: string): ReportReason {
  return REPORT_REASONS.find((reason) => reason === value) ?? 'outro';
}

export async function reportContent(input: {
  kind: ReportKind;
  targetId: string;
  reason: ReportReason;
  note?: string;
}) {
  const { error } = await client().rpc('report_content', {
    p_kind: input.kind,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_note: input.note?.trim() || undefined,
  });
  if (error) throw refusal(error);
}

export async function blockUser(profileId: string) {
  const { error } = await client().rpc('block_user', { p_profile_id: profileId });
  if (error) throw refusal(error);
}

export async function unblockUser(profileId: string) {
  const { error } = await client().rpc('unblock_user', { p_profile_id: profileId });
  if (error) throw refusal(error);
}

export async function fetchBlockedPeople(): Promise<BlockedPerson[]> {
  const { data, error } = await client().rpc('my_blocked_people');
  if (error) throw error;
  return data.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name ?? 'Um adepto',
    blockedAt: row.blocked_at,
  }));
}

/** Profile photos live in a private bucket; an admin opens a reported one through a short-lived signed link. */
async function signedPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const signed = await client().storage.from('avatars').createSignedUrls(paths, 60 * 60);
  if (signed.error) throw signed.error;
  return Object.fromEntries(
    signed.data.flatMap((item) => (item.signedUrl ? [[item.path ?? '', item.signedUrl]] : []))
  );
}

/** The open reports, for admins. */
export async function fetchPendingReports(): Promise<PendingReport[]> {
  const { data, error } = await client().rpc('pending_content_reports');
  if (error) throw error;

  const photoPaths = data.flatMap((row) =>
    row.kind === 'profile_photo' && !row.content_gone && row.content ? [row.content] : []
  );
  const urls = await signedPhotoUrls([...new Set(photoPaths)]);

  return data.map((row) => ({
    reportId: row.report_id,
    kind: reportKind(row.kind),
    targetId: row.target_id,
    reportedProfileId: row.reported_profile_id,
    reportedName: row.reported_name,
    reasons: (row.reasons ?? []).map(reportReason),
    notes: row.notes ?? [],
    reports: row.reports,
    content: row.content,
    photoUrl: row.kind === 'profile_photo' && row.content ? (urls[row.content] ?? null) : null,
    contentGone: row.content_gone === true,
    hidden: row.hidden === true,
    context: row.context ?? '',
    lastReportedAt: row.last_reported_at,
  }));
}

export async function resolveReport(reportId: string, action: ReportAction) {
  const { error } = await client().rpc('resolve_content_report', {
    p_report_id: reportId,
    p_action: action,
  });
  if (error) throw refusal(error);
}
