import { supabase } from '@/lib/supabase';

// Dormir fora, para jogos no estrangeiro e nas ilhas: o que os adeptos pagaram, com a data. A app nunca guarda o
// link de um anúncio — só o que as pessoas dizem ter pago e uma pesquisa no Airbnb que está sempre atual.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type StayRefusal =
  | 'not_signed_in'
  | 'stay_not_needed'
  | 'bad_stay'
  | 'outside_window'
  | 'own_report'
  | 'rate_limited'
  | 'unknown';

export class StayRefused extends Error {
  readonly reason: StayRefusal;

  constructor(reason: StayRefusal) {
    super(reason);
    this.name = 'StayRefused';
    this.reason = reason;
  }
}

function refusal(error: { message: string }) {
  const known: StayRefusal[] = [
    'not_signed_in',
    'stay_not_needed',
    'bad_stay',
    'outside_window',
    'own_report',
    'rate_limited',
  ];
  const found = known.find((reason) => error.message === reason);
  return new StayRefused(found ?? 'unknown');
}

export type StayReport = {
  id: string;
  /** Who said it: a price with a name and a date is worth something; without them it is a rumour. */
  displayName: string;
  /** What the place cost per night, in whole cents, for everyone together. */
  centsPerNight: number;
  people: number;
  nights: number;
  note: string | null;
  /** The day this was told (or last corrected). */
  reportedOn: string;
  isMine: boolean;
  deniedByMe: boolean;
};

/** What fans paid for this game, newest first. Reports two people denied are already gone. */
export async function fetchStays(fixtureId: string): Promise<StayReport[]> {
  const { data, error } = await client().rpc('fixture_stays', { p_fixture_id: fixtureId });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    centsPerNight: row.cents_per_night,
    people: row.people,
    nights: row.nights,
    note: row.note,
    reportedOn: row.reported_on,
    isMine: row.is_mine,
    deniedByMe: row.denied_by_me,
  }));
}

export type NewStay = {
  centsPerNight: number;
  people: number;
  nights: number;
  note: string;
};

/** Tells the others what it cost. Sending it again corrects the previous report and clears its denials. */
export async function reportStay(fixtureId: string, stay: NewStay) {
  const { error } = await client().rpc('report_stay', {
    p_fixture_id: fixtureId,
    p_cents_per_night: stay.centsPerNight,
    p_people: stay.people,
    p_nights: stay.nights,
    p_note: stay.note.trim(),
  });
  if (error) throw refusal(error);
}

/** "Já não encontro nada parecido": two of these and the report stops being shown. */
export async function denyStay(reportId: string) {
  const { error } = await client().rpc('deny_stay_report', { p_report_id: reportId });
  if (error) throw refusal(error);
}
