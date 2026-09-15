/** A fan-information article found on a club's news page, waiting for an admin. */
export type MeetingPointDraft = {
  id: string;
  fixtureId: string;
  /** The club whose site published it. */
  clubId: string;
  sourceUrl: string;
  sourceTitle: string;
  /** The sentences that looked useful (meeting point, transport, gates, rules). */
  excerpt: string;
  foundAt: string;
};

export type MeetingPointOrigin = 'clube' | 'camara' | 'policia';

/** What the admin confirms; the server locates the place on the map. */
export type DraftFields = {
  name: string;
  address: string;
  schedule: string;
  transport: string;
  note: string | null;
  origin: MeetingPointOrigin;
  publishedBy: string;
  /** YYYY-MM-DD. */
  publishedOn: string;
};

export type DraftRefusal = 'invalid-fields' | 'already-decided' | 'not-admin';

export class DraftRefused extends Error {
  readonly reason: DraftRefusal;

  constructor(reason: DraftRefusal) {
    super(reason);
    this.name = 'DraftRefused';
    this.reason = reason;
  }
}
