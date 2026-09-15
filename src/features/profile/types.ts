export type ClubRelation = 'supporter' | 'hometown';

export type MyProfile = {
  id: string;
  displayName: string;
  supporterClubId: string | null;
  /** Only ever visible to its owner (RLS). */
  hometownClubId: string | null;
  /** Match-day suggestions and the season recap: the user decides. */
  nudgesEnabled: boolean;
  recapEnabled: boolean;
  /** Name and club in the rankings. Off unless the user turns it on. */
  showInRankings: boolean;
  /** Can confirm meeting point drafts. Only the owner sets it, never the app. */
  isAdmin: boolean;
};

export type MessagePreferences = Partial<Pick<MyProfile, 'nudgesEnabled' | 'recapEnabled'>>;

export type NotificationKind = 'kickoff_change' | 'weather' | 'group_movement' | 'new_stamp';

/** Only the kinds the user changed; the others follow the app default. */
export type NotificationPreferences = Partial<Record<NotificationKind, boolean>>;
