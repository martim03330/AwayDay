import { supabase } from '@/lib/supabase';

// As contas da viagem. Cada grupo tem, para cada jogo, uma sessão: é lá que entram as despesas do dia (quem pagou,
// quanto, e quem entra em cada uma) e é de lá que sai o acerto no fim. O servidor é quem divide — a app só mostra.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type TripRefusal =
  | 'not_signed_in'
  | 'not_member'
  | 'not_in_ride'
  | 'ride_not_found'
  | 'session_not_found'
  | 'fixture_not_found'
  | 'payer_not_member'
  | 'participant_not_member'
  | 'no_participants'
  | 'bad_expense'
  | 'not_yours'
  | 'rate_limited'
  | 'unknown';

export class TripRefused extends Error {
  readonly reason: TripRefusal;

  constructor(reason: TripRefusal) {
    super(reason);
    this.name = 'TripRefused';
    this.reason = reason;
  }
}

const RECUSAS: TripRefusal[] = [
  'not_signed_in',
  'not_member',
  'not_in_ride',
  'ride_not_found',
  'session_not_found',
  'fixture_not_found',
  'payer_not_member',
  'participant_not_member',
  'no_participants',
  'bad_expense',
  'not_yours',
  'rate_limited',
];

function refusal(error: { message: string }) {
  return new TripRefused(RECUSAS.find((reason) => error.message === reason) ?? 'unknown');
}

/** As caixas onde cabe o dinheiro de um dia de jogo. */
export const CATEGORIAS = [
  'cerveja',
  'petiscos',
  'refeicao',
  'bilhetes',
  'casa',
  'boleia',
  'portagens',
  'outro',
] as const;

export type CategoriaDespesa = (typeof CATEGORIAS)[number];

export function categoria(valor: string | null): CategoriaDespesa {
  return CATEGORIAS.find((nome) => nome === valor) ?? 'outro';
}

export type TripSession = {
  id: string;
  expenses: number;
  totalCents: number;
};

export type TripExpense = {
  id: string;
  description: string;
  category: CategoriaDespesa;
  cents: number;
  payerId: string;
  payerName: string;
  participants: number;
  participantNames: string[];
  /** Se esta despesa também é minha. */
  iAmIn: boolean;
  /** Se a posso apagar: escrevi-a ou fui eu que paguei. */
  mine: boolean;
  createdOn: string;
};

export type TripBalance = {
  profileId: string;
  displayName: string;
  paidCents: number;
  owedCents: number;
  /** Positivo: pôs mais do que lhe cabia. Negativo: deve. */
  balanceCents: number;
  isMe: boolean;
};

/** A sessão deste grupo para este jogo, se já alguém a abriu. */
export async function fetchTripSession(
  groupId: string,
  fixtureId: string
): Promise<TripSession | null> {
  const { data, error } = await client().rpc('trip_session_of', {
    p_group_id: groupId,
    p_fixture_id: fixtureId,
  });
  if (error) throw error;
  const row = data[0];
  return row ? { id: row.id, expenses: row.expenses ?? 0, totalCents: row.total_cents ?? 0 } : null;
}

/** Abre as contas deste jogo (ou devolve as que já lá estavam). */
export async function openTripSession(groupId: string, fixtureId: string): Promise<string> {
  const { data, error } = await client().rpc('open_trip_session', {
    p_group_id: groupId,
    p_fixture_id: fixtureId,
  });
  if (error) throw refusal(error);
  return data;
}

export async function fetchTripExpenses(sessionId: string): Promise<TripExpense[]> {
  const { data, error } = await client().rpc('trip_expenses', { p_session_id: sessionId });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    description: row.description ?? '',
    category: categoria(row.category),
    cents: row.cents ?? 0,
    payerId: row.payer_id,
    payerName: row.payer_name ?? 'Um adepto',
    participants: row.participants ?? 1,
    participantNames: row.participant_names ?? [],
    iAmIn: row.i_am_in === true,
    mine: row.mine === true,
    createdOn: row.created_on ?? '',
  }));
}

/** Quanto cada um pôs e quanto lhe cabe. Quem divide é o servidor. */
export async function fetchTripBalances(sessionId: string): Promise<TripBalance[]> {
  const { data, error } = await client().rpc('trip_balances', { p_session_id: sessionId });
  if (error) throw error;
  return data.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name ?? 'Um adepto',
    paidCents: row.paid_cents ?? 0,
    owedCents: row.owed_cents ?? 0,
    balanceCents: row.balance_cents ?? 0,
    isMe: row.is_me === true,
  }));
}

export type NovaDespesa = {
  sessionId: string;
  description: string;
  category: CategoriaDespesa;
  cents: number;
  /** Quem pôs o dinheiro. Sem isto, fui eu. */
  payerId?: string;
  /** Quem entra na despesa. Sem isto, entra o grupo todo. */
  participants?: string[];
};

export async function addTripExpense(despesa: NovaDespesa): Promise<string> {
  const { data, error } = await client().rpc('add_trip_expense', {
    p_session_id: despesa.sessionId,
    p_description: despesa.description.trim(),
    p_category: despesa.category,
    p_cents: despesa.cents,
    p_payer_id: despesa.payerId,
    p_participants: despesa.participants,
  });
  if (error) throw refusal(error);
  return data;
}

export async function removeTripExpense(expenseId: string) {
  const { error } = await client().rpc('remove_trip_expense', { p_expense_id: expenseId });
  if (error) throw refusal(error);
}

export type TripPerson = {
  profileId: string;
  displayName: string;
  isMe: boolean;
};

/** Quem entra nestas contas: os do grupo, ou os do carro. */
export async function fetchTripPeople(sessionId: string): Promise<TripPerson[]> {
  const { data, error } = await client().rpc('trip_people', { p_session_id: sessionId });
  if (error) throw error;
  return data.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name ?? 'Um adepto',
    isMe: row.is_me === true,
  }));
}

/** As contas de uma boleia, se já alguém as abriu. */
export async function fetchRideTripSession(rideId: string): Promise<TripSession | null> {
  const { data, error } = await client().rpc('ride_trip_session', { p_ride_id: rideId });
  if (error) throw error;
  const row = data[0];
  return row ? { id: row.id, expenses: row.expenses ?? 0, totalCents: row.total_cents ?? 0 } : null;
}

/** Abre as contas de uma boleia. Não cria grupo nenhum: as pessoas são as do carro. */
export async function openRideTripSession(rideId: string): Promise<string> {
  const { data, error } = await client().rpc('open_ride_trip_session', { p_ride_id: rideId });
  if (error) throw refusal(error);
  return data;
}

export type TripAccount = {
  kind: 'grupo' | 'boleia';
  /** O grupo ou a boleia a que estas contas pertencem. */
  ownerId: string;
  title: string;
  /** `null` enquanto ninguém abriu as contas. */
  sessionId: string | null;
  expenses: number;
  totalCents: number;
  /** Positivo: tens a receber. Negativo: deves. */
  myBalanceCents: number;
};

/** As contas deste jogo que te dizem respeito: as dos teus grupos e as das boleias em que vais. */
export async function fetchMyTripAccounts(fixtureId: string): Promise<TripAccount[]> {
  const { data, error } = await client().rpc('my_trip_accounts', { p_fixture_id: fixtureId });
  if (error) throw error;
  return data.map((row) => ({
    kind: row.kind === 'boleia' ? ('boleia' as const) : ('grupo' as const),
    ownerId: row.owner_id,
    title: row.title ?? 'Contas',
    sessionId: row.session_id,
    expenses: row.expenses ?? 0,
    totalCents: row.total_cents ?? 0,
    myBalanceCents: row.my_balance_cents ?? 0,
  }));
}

/** Uma viagem a acontecer agora: a boleia em que vais, desde uma hora antes de sair até ao dia seguinte ao jogo. */
export type LiveTrip = {
  rideId: string;
  fixtureId: string;
  kickoffAt: string;
  departureAt: string;
  driverName: string;
  people: number;
  peopleNames: string[];
  iDrive: boolean;
  sessionId: string | null;
  expenses: number;
  totalCents: number;
  myBalanceCents: number;
};

export async function fetchMyLiveTrips(): Promise<LiveTrip[]> {
  const { data, error } = await client().rpc('my_live_trips');
  if (error) throw error;
  return data.flatMap((row) =>
    row.ride_id && row.fixture_id && row.kickoff_at && row.departure_at
      ? [
          {
            rideId: row.ride_id,
            fixtureId: row.fixture_id,
            kickoffAt: row.kickoff_at,
            departureAt: row.departure_at,
            driverName: row.driver_name ?? 'Um adepto',
            people: row.people ?? 1,
            peopleNames: row.people_names ?? [],
            iDrive: row.i_drive === true,
            sessionId: row.session_id,
            expenses: row.expenses ?? 0,
            totalCents: row.total_cents ?? 0,
            myBalanceCents: row.my_balance_cents ?? 0,
          },
        ]
      : []
  );
}
