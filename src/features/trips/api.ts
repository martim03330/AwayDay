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
  | 'not_in_trip'
  | 'ride_expense'
  | 'stay_expense'
  | 'bad_settlement'
  | 'cannot_add'
  | 'has_money'
  | 'last_person'
  | 'more_than_owed'
  | 'nothing_owed'
  | 'confirmed_settlement'
  | 'not_involved'
  | 'not_session_owner'
  | 'bad_name'
  | 'rate_limited'
  | 'duplicate_request'
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
  'not_in_trip',
  'ride_expense',
  'stay_expense',
  'bad_settlement',
  'cannot_add',
  'has_money',
  'last_person',
  'more_than_owed',
  'nothing_owed',
  'confirmed_settlement',
  'not_involved',
  'not_session_owner',
  'bad_name',
  'rate_limited',
  'duplicate_request',
];

function refusal(error: { message: string }) {
  return new TripRefused(RECUSAS.find((reason) => error.message === reason) ?? 'unknown');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * A fresh id for one money write (an expense or a payment), so a retry of the same request is written only once:
 * the server keeps one row per (session, id) and gives the same row back when the id comes again. The screen makes it
 * once per form and reuses it when the person taps again after a failure.
 *
 * Where the random bytes come from, in order (no new dependency):
 * 1. `crypto.randomUUID` — web, Node (Vitest) and any runtime that has it. Hermes in React Native 0.86 / SDK 57 does
 *    not promise it, so it is only used when present.
 * 2. `globalThis.expo.uuidv4` — installed natively by expo-modules-core in every Expo app (Android `UUID.randomUUID`,
 *    iOS `UUID()`), both from the platform's secure generator.
 * 3. `crypto.getRandomValues` — RFC 4122 version 4 built by hand from 16 random bytes.
 * With none of these it returns `undefined` and the write goes without the protection, as before: no Math.random,
 * because a guessable id would let a retry of someone else's request collide.
 */
export function novoIdDePedido(): string | undefined {
  const ambiente = globalThis as {
    crypto?: { randomUUID?: () => string; getRandomValues?: (bytes: Uint8Array) => Uint8Array };
    expo?: { uuidv4?: () => string };
  };
  const candidatos = [
    () => ambiente.crypto?.randomUUID?.(),
    () => ambiente.expo?.uuidv4?.(),
    () => {
      if (!ambiente.crypto?.getRandomValues) return undefined;
      const bytes = ambiente.crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    },
  ];
  for (const candidato of candidatos) {
    try {
      const id = candidato();
      if (typeof id === 'string' && UUID.test(id)) return id.toLowerCase();
    } catch {
      // Try the next source.
    }
  }
  return undefined;
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
  /** Se a posso apagar: escrevi-a ou fui eu que paguei. Nunca nas que entram sozinhas (boleia, casa). */
  mine: boolean;
  /**
   * 'boleia': entrou sozinha, com o custo da boleia e as pessoas do carro.
   * 'casa': entrou sozinha quando a casa do plano foi reservada, com quem tem cama (ou a sessão toda).
   */
  source: 'manual' | 'boleia' | 'casa';
  createdOn: string;
};

export type TripBalance = {
  profileId: string;
  displayName: string;
  paidCents: number;
  owedCents: number;
  /** Já entregue a outros menos já recebido deles. */
  settledCents: number;
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

function origemDaDespesa(source: string | null): TripExpense['source'] {
  return source === 'boleia' || source === 'casa' ? source : 'manual';
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
    source: origemDaDespesa(row.source),
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
    settledCents: row.settled_cents ?? 0,
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
  /** Id do pedido (`novoIdDePedido`): o mesmo em cada nova tentativa, para a despesa não entrar duas vezes. */
  clientId?: string;
};

export async function addTripExpense(despesa: NovaDespesa): Promise<string> {
  const { data, error } = await client().rpc('add_trip_expense', {
    p_session_id: despesa.sessionId,
    p_description: despesa.description.trim(),
    p_category: despesa.category,
    p_cents: despesa.cents,
    p_payer_id: despesa.payerId,
    p_participants: despesa.participants,
    p_client_id: despesa.clientId,
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
  sessionId: string;
  name: string;
  /** De onde nasceram: de uma boleia, de um grupo, ou do nada. */
  origin: 'boleia' | 'grupo' | 'avulso';
  people: number;
  peopleNames: string[];
  expenses: number;
  totalCents: number;
  /** Positivo: tens a receber. Negativo: deves. */
  myBalanceCents: number;
};

/** As contas deste jogo onde entras. São das pessoas que lá estão — não do grupo nem do carro. */
export async function fetchMyTripAccounts(fixtureId: string): Promise<TripAccount[]> {
  const { data, error } = await client().rpc('my_trip_accounts', { p_fixture_id: fixtureId });
  if (error) throw error;
  return data.map((row) => ({
    sessionId: row.session_id,
    name: row.name ?? 'Contas da viagem',
    origin:
      row.origin === 'boleia'
        ? ('boleia' as const)
        : row.origin === 'grupo'
          ? ('grupo' as const)
          : ('avulso' as const),
    people: row.people ?? 1,
    peopleNames: row.people_names ?? [],
    expenses: row.expenses ?? 0,
    totalCents: row.total_cents ?? 0,
    myBalanceCents: row.my_balance_cents ?? 0,
  }));
}

/** Por onde se podem começar as contas deste jogo: pela boleia em que vais, por um grupo teu, ou do zero. */
export type TripStartOption = {
  kind: 'boleia' | 'grupo';
  id: string;
  title: string;
  people: number;
};

export async function fetchTripStartOptions(fixtureId: string): Promise<TripStartOption[]> {
  const { data, error } = await client().rpc('trip_start_options', { p_fixture_id: fixtureId });
  if (error) throw error;
  return data.flatMap((row) =>
    row.id
      ? [
          {
            kind: row.kind === 'boleia' ? ('boleia' as const) : ('grupo' as const),
            id: row.id,
            title: row.title ?? 'Contas da viagem',
            people: row.people ?? 1,
          },
        ]
      : []
  );
}

/** Abrir contas sem grupo nem boleia: começam só contigo, e acrescentas quem foi. */
export async function startTripSession(fixtureId: string, name?: string): Promise<string> {
  const { data, error } = await client().rpc('start_trip_session', {
    p_fixture_id: fixtureId,
    p_name: name?.trim(),
  });
  if (error) throw refusal(error);
  return data;
}

export async function renameTripSession(sessionId: string, name: string) {
  const { error } = await client().rpc('rename_trip_session', {
    p_session_id: sessionId,
    p_name: name.trim(),
  });
  if (error) throw refusal(error);
}

/** Quem pode entrar nestas contas e ainda não está: amigos, malta dos teus grupos e quem vai no carro. */
export type TripCandidate = {
  profileId: string;
  displayName: string;
  reason: 'amigo' | 'grupo' | 'boleia';
};

export async function fetchTripPeopleToAdd(sessionId: string): Promise<TripCandidate[]> {
  const { data, error } = await client().rpc('trip_people_to_add', { p_session_id: sessionId });
  if (error) throw error;
  return data.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name ?? 'Um adepto',
    reason:
      row.reason === 'amigo'
        ? ('amigo' as const)
        : row.reason === 'boleia'
          ? ('boleia' as const)
          : ('grupo' as const),
  }));
}

export async function addTripPerson(sessionId: string, profileId: string) {
  const { error } = await client().rpc('add_trip_person', {
    p_session_id: sessionId,
    p_profile_id: profileId,
  });
  if (error) throw refusal(error);
}

/** Apagar umas contas abertas por engano. Só enquanto não houver despesas nem pagamentos lá dentro. */
export async function removeTripSession(sessionId: string) {
  const { error } = await client().rpc('remove_trip_session', { p_session_id: sessionId });
  if (error) throw refusal(error);
}

export async function removeTripPerson(sessionId: string, profileId: string) {
  const { error } = await client().rpc('remove_trip_person', {
    p_session_id: sessionId,
    p_profile_id: profileId,
  });
  if (error) throw refusal(error);
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

/** Um jogo já passado: com quem foste e o que se gastou. */
export type TripHistoryEntry = {
  fixtureId: string;
  kickoffAt: string;
  companions: number;
  companionNames: string[];
  expenses: number;
  totalCents: number;
  myBalanceCents: number;
};

export async function fetchMyTripHistory(): Promise<TripHistoryEntry[]> {
  const { data, error } = await client().rpc('my_trip_history');
  if (error) throw error;
  return data.flatMap((row) =>
    row.fixture_id && row.kickoff_at
      ? [
          {
            fixtureId: row.fixture_id,
            kickoffAt: row.kickoff_at,
            companions: row.companions ?? 0,
            companionNames: row.companion_names ?? [],
            expenses: row.expenses ?? 0,
            totalCents: row.total_cents ?? 0,
            myBalanceCents: row.my_balance_cents ?? 0,
          },
        ]
      : []
  );
}

/** Dinheiro que já mudou de mãos dentro destas contas. */
export type TripSettlement = {
  id: string;
  fromProfileId: string;
  fromName: string;
  toProfileId: string;
  toName: string;
  cents: number;
  /** Quem recebeu já disse que recebeu. */
  confirmed: boolean;
  iReceive: boolean;
  /** Se o posso apagar: estive nele ou fui eu que o lancei. */
  mine: boolean;
  createdOn: string;
  /** Até quando eu, que recebi, ainda posso desfazer a confirmação (10 minutos). `null` se não for eu a receber. */
  receiverUndoUntil: string | null;
};

export async function fetchTripSettlements(sessionId: string): Promise<TripSettlement[]> {
  const { data, error } = await client().rpc('trip_settlements', { p_session_id: sessionId });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    fromProfileId: row.from_profile_id,
    fromName: row.from_name ?? 'Um adepto',
    toProfileId: row.to_profile_id,
    toName: row.to_name ?? 'Um adepto',
    cents: row.cents ?? 0,
    confirmed: row.confirmed === true,
    iReceive: row.i_receive === true,
    mine: row.mine === true,
    createdOn: row.created_on ?? '',
    receiverUndoUntil: row.receiver_undo_until,
  }));
}

/**
 * Registar um pagamento. Sem `fromProfileId`, fui eu que paguei — e fica por confirmar até quem recebeu dizer que
 * recebeu. Se for eu a receber, fica confirmado logo.
 */
export async function addTripSettlement(
  sessionId: string,
  toProfileId: string,
  cents: number,
  fromProfileId?: string,
  /** Id do pedido (`novoIdDePedido`), o mesmo em cada nova tentativa: o pagamento fica registado uma vez só. */
  clientId?: string
): Promise<string> {
  const { data, error } = await client().rpc('add_trip_settlement', {
    p_session_id: sessionId,
    p_to_profile_id: toProfileId,
    p_cents: cents,
    p_from_profile_id: fromProfileId,
    p_client_id: clientId,
  });
  if (error) throw refusal(error);
  return data;
}

export async function confirmTripSettlement(settlementId: string) {
  const { error } = await client().rpc('confirm_trip_settlement', {
    p_settlement_id: settlementId,
  });
  if (error) throw refusal(error);
}

export async function removeTripSettlement(settlementId: string) {
  const { error } = await client().rpc('remove_trip_settlement', { p_settlement_id: settlementId });
  if (error) throw refusal(error);
}

/**
 * A sessão da viagem, como aparece na página dos Jogos e no ecrã da sessão: o jogo, quem vai, quem dá a boleia e a
 * que horas sai, e o dinheiro. Nasce do plano fechado e aparece na véspera do jogo.
 */
export type TripSessionCard = {
  sessionId: string;
  name: string;
  fixtureId: string;
  kickoffAt: string;
  /** A partir de quando aparece na página dos Jogos. */
  opensAt: string;
  planId: string | null;
  groupId: string | null;
  people: number;
  peopleNames: string[];
  ride: {
    id: string;
    driverId: string;
    driverName: string;
    departureAt: string;
    originName: string;
    iDrive: boolean;
    /** A despesa do carro, e por quantos se divide (contas do servidor). `null` enquanto não houver. */
    cents: number | null;
    people: number | null;
  } | null;
  expenses: number;
  totalCents: number;
  /** Positivo: tens a receber. Negativo: deves. */
  myBalanceCents: number;
};

export async function fetchTripSessionCards(sessionIds: string[]): Promise<TripSessionCard[]> {
  if (sessionIds.length === 0) return [];
  const { data, error } = await client().rpc('trip_session_cards', { p_session_ids: sessionIds });
  if (error) throw error;
  return data.map((row) => ({
    sessionId: row.session_id,
    name: row.name ?? 'A viagem',
    fixtureId: row.fixture_id,
    kickoffAt: row.kickoff_at,
    opensAt: row.opens_at,
    planId: row.plan_id,
    groupId: row.group_id,
    people: row.people ?? 0,
    peopleNames: row.people_names ?? [],
    ride:
      row.ride_id && row.driver_id && row.departure_at
        ? {
            id: row.ride_id,
            driverId: row.driver_id,
            driverName: row.driver_name ?? 'Um adepto',
            departureAt: row.departure_at,
            originName: row.origin_name ?? '',
            iDrive: row.i_drive === true,
            cents: row.ride_cents,
            people: row.ride_people,
          }
        : null,
    expenses: row.expenses ?? 0,
    totalCents: row.total_cents ?? 0,
    myBalanceCents: row.my_balance_cents ?? 0,
  }));
}

/** As sessões abertas agora: da véspera do jogo (ou dois dias antes, fora do país) até três dias depois. */
export async function fetchMyOpenTripSessions(): Promise<TripSessionCard[]> {
  const { data, error } = await client().rpc('my_open_trip_sessions');
  if (error) throw error;
  const ids = data.filter((id): id is string => typeof id === 'string');
  const cartoes = await fetchTripSessionCards(ids);
  return ids.flatMap((id) => cartoes.filter((cartao) => cartao.sessionId === id));
}
