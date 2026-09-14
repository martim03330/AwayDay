export type ClubRelation = 'supporter' | 'hometown';

export type MyProfile = {
  id: string;
  displayName: string;
  supporterClubId: string | null;
  /** Only ever visible to its owner (RLS). */
  hometownClubId: string | null;
};
