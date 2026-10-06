/** What can be reported. 'message' is a group chat message; 'ride_message' a car chat message. */
export type ReportKind = 'message' | 'ride_message' | 'profile' | 'profile_photo' | 'group';

export const REPORT_REASONS = ['ofensivo', 'assedio', 'spam', 'perigoso', 'outro'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** How each reason reads on screen. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  ofensivo: 'Ofensivo',
  assedio: 'Assédio',
  spam: 'Spam',
  perigoso: 'Perigoso',
  outro: 'Outra coisa',
};

/** What an admin can do with a report. */
export type ReportAction = 'esconder' | 'tirar_foto' | 'resolver' | 'rejeitar';

export type BlockedPerson = {
  profileId: string;
  displayName: string;
  blockedAt: string;
};

/** One thing reported (all open reports on it together). Never says who reported it. */
export type PendingReport = {
  /** The most recent report: acting on it closes every open report on the same thing. */
  reportId: string;
  kind: ReportKind;
  targetId: string;
  reportedProfileId: string | null;
  reportedName: string | null;
  reasons: ReportReason[];
  notes: string[];
  reports: number;
  /** The message, the name, the group name, or the photo's storage path. */
  content: string | null;
  /** Signed link, for a reported photo that is still up. */
  photoUrl: string | null;
  /** The author deleted it (or the photo was changed) since it was reported. */
  contentGone: boolean;
  hidden: boolean;
  context: string;
  lastReportedAt: string;
};
