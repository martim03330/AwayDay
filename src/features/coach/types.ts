export type CoachMessage = {
  id: string;
  body: string;
  kind: string;
  /** The fixture the message is about, so tapping it can open the game. */
  fixtureId: string | null;
};
