import { corpoDoErroDaFuncao } from '@/lib/erros-funcoes';
import { supabase } from '@/lib/supabase';
import type { Coordenadas } from '@/mocks/tipos';

// Rides to a game (slice 3). Costs always come from the server: the `rides` Edge Function quotes and creates rides,
// and the database functions keep seats and prices consistent.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type RouteOption = 'rapida' | 'equilibrio' | 'sem_portagens';

export type RideQuote = {
  option: RouteOption;
  distanceM: number;
  durationS: number;
  tollM: number;
  fuelCents: number;
  tollCents: number;
  totalCents: number;
  /** What each person pays with 1 (the driver alone), 2, 3… people in the car. */
  shareCentsByPeople: number[];
};

export type TripSettings = {
  fixtureId: string;
  origin: { latitude: number; longitude: number };
  /** 6,5 L/100 km = 650. */
  consumptionClPer100Km: number;
  /** 2,072 €/L = 2072. */
  fuelPriceMilliPerLitre: number;
  roundTrip: boolean;
};

export type NewRide = TripSettings & {
  originName: string;
  departureAt: string;
  seatsOffered: number;
  routeOption: RouteOption;
  note: string;
  /** Where the car is left near the stadium (a researched car park), when chosen. */
  parkingSpotId: string | null;
  /** The driver went through the commitment screen. */
  acceptedRules: true;
  /** The driver takes requests for a seat home from fans who missed their transport (round trips only). */
  acceptsReturnRequests: boolean;
};

export type RideRefusal =
  | 'not_signed_in'
  | 'too_far'
  | 'no_route'
  | 'rate_limited'
  | 'bad_departure'
  | 'fixture_started'
  | 'ride_full'
  | 'ride_closed'
  | 'own_ride'
  | 'already_offering'
  | 'rules_not_accepted'
  | 'suspended'
  | 'outside_window'
  | 'not_participant'
  | 'bad_parking'
  | 'no_return_seats'
  | 'already_going'
  | 'too_late'
  | 'request_not_found'
  | 'bad_location'
  | 'unknown';

export class RideRefused extends Error {
  readonly reason: RideRefusal;

  constructor(reason: RideRefusal) {
    super(reason);
    this.name = 'RideRefused';
    this.reason = reason;
  }
}

const REASONS: readonly RideRefusal[] = [
  'not_signed_in',
  'too_far',
  'no_route',
  'rate_limited',
  'bad_departure',
  'fixture_started',
  'ride_full',
  'ride_closed',
  'own_ride',
  'already_offering',
  'rules_not_accepted',
  'suspended',
  'outside_window',
  'not_participant',
  'bad_parking',
];

function toReason(value: unknown): RideRefusal {
  return REASONS.find((reason) => reason === value) ?? 'unknown';
}

async function functionError(error: unknown) {
  const body = await corpoDoErroDaFuncao(error);
  return new RideRefused(toReason(body?.error));
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : 0;
}

function isRouteOption(value: unknown): value is RouteOption {
  return value === 'rapida' || value === 'equilibrio' || value === 'sem_portagens';
}

/** The routes from the meeting point to the stadium, with their costs. */
export async function quoteRide(settings: TripSettings): Promise<RideQuote[]> {
  const { data, error } = await client().functions.invoke('rides', {
    body: { action: 'quote', ...settings },
  });
  if (error) throw await functionError(error);
  const quotes: unknown[] =
    typeof data === 'object' && data !== null && Array.isArray(Reflect.get(data, 'quotes'))
      ? Reflect.get(data, 'quotes')
      : [];
  return quotes.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const option = Reflect.get(item, 'option');
    const shares = Reflect.get(item, 'share_cents_by_people');
    if (!isRouteOption(option) || !Array.isArray(shares)) return [];
    return [
      {
        option,
        distanceM: toNumber(Reflect.get(item, 'distance_m')),
        durationS: toNumber(Reflect.get(item, 'duration_s')),
        tollM: toNumber(Reflect.get(item, 'toll_m')),
        fuelCents: toNumber(Reflect.get(item, 'fuel_cents')),
        tollCents: toNumber(Reflect.get(item, 'toll_cents')),
        totalCents: toNumber(Reflect.get(item, 'total_cents')),
        shareCentsByPeople: shares.map(toNumber),
      },
    ];
  });
}

export type PlaceResult = {
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
  /** Straight line from where the search was centred, when it was. */
  distanceM: number | null;
};

/** Streets and places for the meeting point, nearest to `near` first (OpenStreetMap, through the server). */
export async function searchPlace(
  query: string,
  near: { latitude: number; longitude: number } | null
): Promise<PlaceResult[]> {
  const { data, error } = await client().functions.invoke('rides', {
    body: { action: 'search', query, near },
  });
  if (error) throw await functionError(error);
  const results: unknown[] =
    typeof data === 'object' && data !== null && Array.isArray(Reflect.get(data, 'results'))
      ? Reflect.get(data, 'results')
      : [];
  return results.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const name = Reflect.get(item, 'name');
    const detail = Reflect.get(item, 'detail');
    const latitude = Reflect.get(item, 'latitude');
    const longitude = Reflect.get(item, 'longitude');
    const distance = Reflect.get(item, 'distance_m');
    if (typeof name !== 'string' || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return [];
    }
    return [
      {
        name,
        detail: typeof detail === 'string' ? detail : '',
        latitude,
        longitude,
        distanceM: typeof distance === 'number' ? distance : null,
      },
    ];
  });
}

/** Opens a ride. Returns its id. */
export async function createRide(ride: NewRide): Promise<string> {
  const { data, error } = await client().functions.invoke('rides', {
    body: { action: 'create', ...ride },
  });
  if (error) throw await functionError(error);
  const id = typeof data === 'object' && data !== null ? Reflect.get(data, 'id') : null;
  if (typeof id !== 'string') throw new RideRefused('unknown');
  return id;
}

export type RideSummary = {
  id: string;
  isMine: boolean;
  driverId: string;
  driverName: string;
  /** The driver's finished rides and faults in the last 6 months. */
  driverCompleted: number;
  driverFaults: number;
  originName: string;
  /** O concelho de onde a boleia saiu — e para onde volta. `null` quando não se soube. */
  originCity: string | null;
  origin: { latitude: number; longitude: number };
  departureAt: string;
  /** Requests close (and cancelling becomes a fault) at this time. */
  requestsCloseAt: string;
  seatsOffered: number;
  seatsTaken: number;
  routeOption: RouteOption;
  roundTrip: boolean;
  /** O condutor aceita pedidos de boleia de volta. */
  acceptsReturnRequests: boolean;
  distanceM: number;
  durationS: number;
  tollM: number;
  fuelCents: number;
  tollCents: number;
  totalCents: number;
  /** What each person pays with the seats taken now. */
  shareNowCents: number;
  /** What each person pays with every seat taken. */
  shareFullCents: number;
  note: string | null;
  status: 'open' | 'cancelled';
  /** The caller's place in this ride; `null` when they have not asked. */
  myStatus: 'requested' | 'accepted' | 'declined' | 'left' | 'left_late' | 'expired' | null;
  /** The group this ride belongs to, when the driver said it is the group's car. `null` to outsiders. */
  groupId: string | null;
  groupName: string | null;
  /** 'grupo': só a malta do grupo a vê. 'publica': aparece a toda a gente. */
  visibility: 'grupo' | 'publica';
  /** Where the car is left, when the driver chose a car park. */
  parking: {
    name: string;
    location: { latitude: number; longitude: number } | null;
    distanceM: number | null;
  } | null;
};

function toMyStatus(value: string | null): RideSummary['myStatus'] {
  return value === 'requested' ||
    value === 'accepted' ||
    value === 'declined' ||
    value === 'left' ||
    value === 'left_late' ||
    value === 'expired'
    ? value
    : null;
}

/** The rides for a game: open ones, and the ones the user drives or joined. */
export async function fetchRideBoard(fixtureId: string): Promise<RideSummary[]> {
  const { data, error } = await client().rpc('ride_board', { p_fixture_id: fixtureId });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    isMine: row.is_mine,
    driverId: row.driver_id,
    driverName: row.driver_name,
    driverCompleted: row.driver_completed,
    driverFaults: row.driver_faults,
    originName: row.origin_name,
    originCity: row.origin_city,
    origin: { latitude: row.origin_latitude, longitude: row.origin_longitude },
    departureAt: row.departure_at,
    requestsCloseAt: row.requests_close_at,
    seatsOffered: row.seats_offered,
    seatsTaken: row.seats_taken,
    routeOption: isRouteOption(row.route_option) ? row.route_option : 'rapida',
    roundTrip: row.round_trip,
    acceptsReturnRequests: row.accepts_return_requests === true,
    distanceM: row.distance_m,
    durationS: row.duration_s,
    tollM: row.toll_m,
    fuelCents: row.fuel_cents,
    tollCents: row.toll_cents,
    totalCents: row.total_cents,
    shareNowCents: row.share_now_cents,
    shareFullCents: row.share_full_cents,
    note: row.note,
    status: row.status === 'cancelled' ? 'cancelled' : 'open',
    myStatus: toMyStatus(row.my_status),
    groupId: row.group_id,
    groupName: row.group_name,
    visibility: row.visibility === 'grupo' ? 'grupo' : 'publica',
    parking: row.parking_name
      ? {
          name: row.parking_name,
          location:
            row.parking_latitude !== null && row.parking_longitude !== null
              ? { latitude: row.parking_latitude, longitude: row.parking_longitude }
              : null,
          distanceM: row.parking_distance_m,
        }
      : null,
  }));
}

export type RidePerson = {
  profileId: string;
  name: string;
  status: 'driver' | 'requested' | 'accepted' | 'left_late';
  /** Finished rides and faults in the last 6 months. */
  completed: number;
  faults: number;
};

/** Who is in a ride: everyone who asked, for the driver; the car's people, for an accepted passenger. */
export async function fetchRidePeople(rideId: string): Promise<RidePerson[]> {
  const { data, error } = await client().rpc('ride_people', { p_ride_id: rideId });
  if (error) throw error;
  return data.flatMap((row) =>
    row.status === 'driver' ||
    row.status === 'requested' ||
    row.status === 'accepted' ||
    row.status === 'left_late'
      ? [
          {
            profileId: row.profile_id,
            name: row.display_name,
            status: row.status,
            completed: row.completed,
            faults: row.faults,
          },
        ]
      : []
  );
}

/** A refusal raised by a database function ("ride_full", …) as a reason the screens can explain. */
function rpcError(error: { message: string }) {
  return new RideRefused(toReason(error.message));
}

/** Asks for a seat. Only after the commitment screen: the server refuses without it. */
export async function requestSeat(rideId: string) {
  const { error } = await client().rpc('request_ride_seat', {
    p_ride_id: rideId,
    p_accept_rules: true,
  });
  if (error) throw rpcError(error);
}

export async function answerRequest(rideId: string, profileId: string, accept: boolean) {
  const { error } = await client().rpc('answer_ride_request', {
    p_ride_id: rideId,
    p_profile_id: profileId,
    p_accept: accept,
  });
  if (error) throw rpcError(error);
}

export async function leaveRide(rideId: string) {
  const { error } = await client().rpc('leave_ride', { p_ride_id: rideId });
  if (error) throw rpcError(error);
}

export async function cancelRide(rideId: string) {
  const { error } = await client().rpc('cancel_ride', { p_ride_id: rideId });
  if (error) throw rpcError(error);
}

export type IncidentReason =
  'doenca' | 'avaria' | 'acidente_transito' | 'trabalho_familia' | 'outro';

function isReason(value: string): value is IncidentReason {
  return (
    value === 'doenca' ||
    value === 'avaria' ||
    value === 'acidente_transito' ||
    value === 'trabalho_familia' ||
    value === 'outro'
  );
}

export type RideIncident = {
  id: string;
  profileId: string;
  name: string;
  reason: IncidentReason;
  note: string | null;
  accepts: number;
  rejects: number;
  /** The caller's vote; `null` when they have not voted (or it is their own). */
  myVote: boolean | null;
};

/** Unforeseen events reported in a ride, with the votes. Only participants see them. */
export async function fetchRideIncidents(rideId: string): Promise<RideIncident[]> {
  const { data, error } = await client().rpc('ride_incidents', { p_ride_id: rideId });
  if (error) throw error;
  return data.flatMap((row) =>
    isReason(row.reason)
      ? [
          {
            id: row.id,
            profileId: row.profile_id,
            name: row.display_name,
            reason: row.reason,
            note: row.note,
            accepts: row.accepts,
            rejects: row.rejects,
            myVote: row.my_vote,
          },
        ]
      : []
  );
}

export async function reportIncident(rideId: string, reason: IncidentReason, note: string) {
  const { error } = await client().rpc('report_ride_incident', {
    p_ride_id: rideId,
    p_reason: reason,
    p_note: note,
  });
  if (error) throw rpcError(error);
}

export async function voteIncident(incidentId: string, accept: boolean) {
  const { error } = await client().rpc('vote_ride_incident', {
    p_incident_id: incidentId,
    p_accept: accept,
  });
  if (error) throw rpcError(error);
}

/** Who the caller said turned up, by person. */
export async function fetchMyAttendance(rideId: string): Promise<Record<string, boolean>> {
  const { data, error } = await client().rpc('my_ride_attendance', { p_ride_id: rideId });
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.subject_id, row.showed_up]));
}

export async function reportAttendance(rideId: string, subjectId: string, showedUp: boolean) {
  const { error } = await client().rpc('report_ride_attendance', {
    p_ride_id: rideId,
    p_subject_id: subjectId,
    p_showed_up: showedUp,
  });
  if (error) throw rpcError(error);
}

export type MyRide = {
  id: string;
  fixtureId: string;
  originName: string;
  departureAt: string;
  role: 'driver' | 'passenger';
  status: 'open' | 'cancelled';
};

/** Rides the caller drives or has a seat in, from three days ago on. */
export async function fetchMyRides(): Promise<MyRide[]> {
  const { data, error } = await client().rpc('my_rides');
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    fixtureId: row.fixture_id,
    originName: row.origin_name,
    departureAt: row.departure_at,
    role: row.role === 'driver' ? 'driver' : 'passenger',
    status: row.status === 'cancelled' ? 'cancelled' : 'open',
  }));
}

export type RideReputation = {
  completed: number;
  faults: number;
  excused: number;
  /** When the suspension ends; `null` when not suspended. */
  bannedUntil: string | null;
};

export async function fetchReputation(profileId: string): Promise<RideReputation> {
  const { data, error } = await client().rpc('ride_reputation', { p_profile_ids: [profileId] });
  if (error) throw error;
  const row = data[0];
  return {
    completed: row?.completed ?? 0,
    faults: row?.faults ?? 0,
    excused: row?.excused ?? 0,
    bannedUntil: row?.banned_until ?? null,
  };
}

export type RideAlert = {
  kind:
    | 'pedidos'
    | 'aceite'
    | 'recusado'
    | 'sem_resposta'
    | 'cancelada'
    | 'volta_pedidos'
    | 'volta_aceite'
    | 'volta_recusado';
  rideId: string;
  fixtureId: string;
  /** Requests waiting for an answer (only for 'pedidos'). */
  pending: number;
  requestsCloseAt: string;
  departureAt: string;
  driverName: string | null;
};

function isAlertKind(value: string): value is RideAlert['kind'] {
  return (
    value === 'pedidos' ||
    value === 'aceite' ||
    value === 'recusado' ||
    value === 'sem_resposta' ||
    value === 'cancelada' ||
    value === 'volta_pedidos' ||
    value === 'volta_aceite' ||
    value === 'volta_recusado'
  );
}

/** What needs the fan's attention about rides, most urgent first. */
export async function fetchMyRideAlerts(): Promise<RideAlert[]> {
  const { data, error } = await client().rpc('my_ride_alerts');
  if (error) throw error;
  return data.flatMap((row) =>
    isAlertKind(row.kind)
      ? [
          {
            kind: row.kind,
            rideId: row.ride_id,
            fixtureId: row.fixture_id,
            pending: row.pending,
            requestsCloseAt: row.requests_close_at,
            departureAt: row.departure_at,
            driverName: row.driver_name,
          },
        ]
      : []
  );
}

// Boleia de volta: a seat home for a fan who missed their transport. The server decides everything — the window,
// the price (their share of half the trip) and how far they are from the car. Their position is never stored.

export type ReturnRide = {
  rideId: string;
  driverName: string;
  driverCompleted: number;
  driverFaults: number;
  seatsLeft: number;
  /** What this fan would pay: their share of the way home, in cents. */
  priceCents: number;
  parkingName: string | null;
  parking: { latitude: number; longitude: number } | null;
  originName: string;
  /** Para onde este carro volta. */
  originCity: string | null;
  myStatus: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled' | null;
};

export type ReturnPerson = {
  profileId: string;
  displayName: string;
  status: 'pending' | 'accepted';
  /** How far they are from the car, rounded to 100 m. Never a position. */
  distanceToCarM: number;
  shareCents: number;
  completed: number;
  faults: number;
};

function toReturnStatus(value: string | null): ReturnRide['myStatus'] {
  return value === 'pending' ||
    value === 'accepted' ||
    value === 'declined' ||
    value === 'expired' ||
    value === 'cancelled'
    ? value
    : null;
}

/** Rides going home from this game with room left, while the window is open. Empty outside it. */
export async function fetchReturnBoard(fixtureId: string): Promise<ReturnRide[]> {
  const { data, error } = await client().rpc('ride_return_board', { p_fixture_id: fixtureId });
  if (error) throw error;
  return data.map((row) => ({
    rideId: row.ride_id,
    driverName: row.driver_name,
    driverCompleted: row.driver_completed,
    driverFaults: row.driver_faults,
    seatsLeft: row.seats_left,
    priceCents: row.price_cents,
    parkingName: row.parking_name,
    parking:
      row.parking_latitude !== null && row.parking_longitude !== null
        ? { latitude: row.parking_latitude, longitude: row.parking_longitude }
        : null,
    originName: row.origin_name,
    originCity: row.origin_city,
    myStatus: toReturnStatus(row.my_status),
  }));
}

/** Asks for a seat home. The position only serves to tell the driver how far away the fan is. */
export async function requestReturnSeat(rideId: string, here: Coordenadas) {
  const { error } = await client().rpc('request_return_seat', {
    p_ride_id: rideId,
    p_latitude: here.latitude,
    p_longitude: here.longitude,
    p_accept_rules: true,
  });
  if (error) throw rpcError(error);
}

export async function answerReturnRequest(rideId: string, profileId: string, accept: boolean) {
  const { error } = await client().rpc('answer_return_request', {
    p_ride_id: rideId,
    p_profile_id: profileId,
    p_accept: accept,
  });
  if (error) throw rpcError(error);
}

export async function cancelReturnRequest(rideId: string) {
  const { error } = await client().rpc('cancel_return_request', { p_ride_id: rideId });
  if (error) throw rpcError(error);
}

/** Who asked for a seat home in this ride: the driver sees everyone, a fan sees only themselves. */
export async function fetchReturnPeople(rideId: string): Promise<ReturnPerson[]> {
  const { data, error } = await client().rpc('ride_return_people', { p_ride_id: rideId });
  if (error) throw error;
  return data.flatMap((row) =>
    row.status === 'pending' || row.status === 'accepted'
      ? [
          {
            profileId: row.profile_id,
            displayName: row.display_name,
            status: row.status,
            distanceToCarM: row.distance_to_car_m,
            shareCents: row.share_cents,
            completed: row.completed,
            faults: row.faults,
          },
        ]
      : []
  );
}

/** Diz de que grupo é esta boleia (ou `null` para nenhum). Só o condutor, e só grupos onde ele está. */
export async function setRideGroup(rideId: string, groupId: string | null) {
  const { error } = await client().rpc('set_ride_group', {
    p_ride_id: rideId,
    p_group_id: groupId ?? undefined,
  });
  if (error) throw rpcError(error);
}

/** Abre a boleia a toda a gente, ou volta a fechá-la ao grupo. Só o condutor. */
export async function setRideVisibility(rideId: string, publica: boolean) {
  const { error } = await client().rpc('set_ride_visibility', {
    p_ride_id: rideId,
    p_public: publica,
  });
  if (error) throw rpcError(error);
}

/** Abre (ou fecha) os lugares da volta, mesmo com o jogo a decorrer. Só o condutor. */
export async function setRideReturnRequests(rideId: string, accepts: boolean) {
  const { error } = await client().rpc('set_ride_return_requests', {
    p_ride_id: rideId,
    p_accepts: accepts,
  });
  if (error) throw rpcError(error);
}
