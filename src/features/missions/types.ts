export type MissionPhoto = {
  missionId: string;
  storagePath: string;
  /** Short-lived signed URL to show the photo; `null` if the file could not be signed. */
  url: string | null;
  fixtureId: string | null;
  venueId: string | null;
  /** Decided by the server: taken on a match day with a check-in near that stadium. */
  verified: boolean;
  takenAt: string;
};

export type MissionPhotoInput = {
  missionId: string;
  /** Local file from the camera. */
  uri: string;
  mimeType: string;
  /** What the phone believes; the server replaces it when it can verify the photo. */
  fixtureId: string | null;
  venueId: string | null;
};
