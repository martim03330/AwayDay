import { supabase } from '@/lib/supabase';

// Onde dormir, em jogos no estrangeiro e nas ilhas. Não guardamos preços de anúncios nem disponibilidade — isso
// vê-se no Airbnb, pela pesquisa que a app abre. O que vive aqui são intenções de pessoas: quem procura casa e até
// quanto paga, e quem já tem casa com lugares a sobrar.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type StayRefusal =
  'not_signed_in' | 'stay_not_needed' | 'bad_stay' | 'outside_window' | 'rate_limited' | 'unknown';

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
    'rate_limited',
  ];
  return new StayRefused(known.find((reason) => error.message === reason) ?? 'unknown');
}

export type StayKind = 'procura' | 'tem_casa';
/** 'certo': reserva mesmo que ninguém se junte. 'se_houver': só se houver com quem dividir. */
export type StayCommitment = 'certo' | 'se_houver';

export type StayPlan = {
  id: string;
  displayName: string;
  kind: StayKind;
  /** Por pessoa e por noite, em cêntimos inteiros: o máximo que paga, ou quanto fica a quem entrar na casa. */
  centsPerPerson: number;
  nights: number;
  /** Só em 'procura': com que convicção. */
  commitment: StayCommitment | null;
  /** Só em 'tem_casa': lugares que ainda sobram. */
  sparePlaces: number | null;
  note: string | null;
  updatedOn: string;
  isMine: boolean;
};

function toKind(value: string): StayKind {
  return value === 'tem_casa' ? 'tem_casa' : 'procura';
}

function toCommitment(value: string | null): StayCommitment | null {
  return value === 'certo' || value === 'se_houver' ? value : null;
}

/** Quem está a tratar de cama para este jogo: primeiro quem já tem casa, depois quem está mais decidido. */
export async function fetchStayPlans(fixtureId: string): Promise<StayPlan[]> {
  const { data, error } = await client().rpc('fixture_stay_plans', { p_fixture_id: fixtureId });
  if (error) throw error;
  // O servidor devolve colunas anuláveis; uma linha sem o essencial não se mostra a ninguém.
  return data.flatMap((row) =>
    row.cents_per_person === null || row.nights === null
      ? []
      : [
          {
            id: row.id,
            displayName: row.display_name ?? 'Um adepto',
            kind: toKind(row.kind ?? 'procura'),
            centsPerPerson: row.cents_per_person,
            nights: row.nights,
            commitment: toCommitment(row.commitment),
            sparePlaces: row.spare_places,
            note: row.note,
            updatedOn: row.updated_on ?? '',
            isMine: row.is_mine === true,
          },
        ]
  );
}

export type NewStayPlan = {
  kind: StayKind;
  centsPerPerson: number;
  nights: number;
  commitment: StayCommitment | null;
  sparePlaces: number | null;
  note: string;
};

/** Diz (ou corrige) o que vais fazer quanto a dormir. Um por pessoa e por jogo. */
export async function setStayPlan(fixtureId: string, plan: NewStayPlan) {
  const { error } = await client().rpc('set_stay_plan', {
    p_fixture_id: fixtureId,
    p_kind: plan.kind,
    p_cents_per_person: plan.centsPerPerson,
    p_nights: plan.nights,
    p_commitment: plan.commitment ?? undefined,
    p_spare_places: plan.sparePlaces ?? undefined,
    p_note: plan.note.trim(),
  });
  if (error) throw refusal(error);
}

/** Desisti: sai da lista. */
export async function removeStayPlan(fixtureId: string) {
  const { error } = await client().rpc('remove_stay_plan', { p_fixture_id: fixtureId });
  if (error) throw refusal(error);
}
