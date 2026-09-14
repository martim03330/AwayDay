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
};

export type MessagePreferences = Partial<Pick<MyProfile, 'nudgesEnabled' | 'recapEnabled'>>;
