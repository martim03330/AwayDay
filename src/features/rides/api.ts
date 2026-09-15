import { corpoDoErroDaFuncao } from '@/lib/erros-funcoes';
import { supabase } from '@/lib/supabase';

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
  driverName: string;
  originName: string;
  origin: { latitude: number; longitude: number };
  departureAt: string;
  seatsOffered: number;
  seatsTaken: number;
  routeOption: RouteOption;
  roundTrip: boolean;
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
  myStatus: 'requested' | 'accepted' | 'declined' | 'left' | null;
};

function toMyStatus(value: string | null): RideSummary['myStatus'] {
  return value === 'requested' || value === 'accepted' || value === 'declined' || value === 'left'
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
    driverName: row.driver_name,
    originName: row.origin_name,
    origin: { latitude: row.origin_latitude, longitude: row.origin_longitude },
    departureAt: row.departure_at,
    seatsOffered: row.seats_offered,
    seatsTaken: row.seats_taken,
    routeOption: isRouteOption(row.route_option) ? row.route_option : 'rapida',
    roundTrip: row.round_trip,
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
  }));
}

export type RidePerson = {
  profileId: string;
  name: string;
  status: 'driver' | 'requested' | 'accepted';
};

/** Who is in a ride: everyone who asked, for the driver; the car's people, for an accepted passenger. */
export async function fetchRidePeople(rideId: string): Promise<RidePerson[]> {
  const { data, error } = await client().rpc('ride_people', { p_ride_id: rideId });
  if (error) throw error;
  return data.flatMap((row) =>
    row.status === 'driver' || row.status === 'requested' || row.status === 'accepted'
      ? [{ profileId: row.profile_id, name: row.display_name, status: row.status }]
      : []
  );
}

/** A refusal raised by a database function ("ride_full", …) as a reason the screens can explain. */
function rpcError(error: { message: string }) {
  return new RideRefused(toReason(error.message));
}

export async function requestSeat(rideId: string) {
  const { error } = await client().rpc('request_ride_seat', { p_ride_id: rideId });
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
