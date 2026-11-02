import type {
  ClubBooking,
  ClubBookingStatus,
  ClubTripErrorReason,
  ClubTripFull,
  ClubTripListItem,
  ClubTripNotice,
  ClubTripStatus,
  ClubTripVehicleSummary,
  ClubVehicleKind,
  ManageBookingAction,
  MyClubBooking,
  NewClubTrip,
  NewClubTripVehicle,
  SupportersClub,
  SupportersClubManager,
  SupportersClubRole,
  SupportersClubStatus,
  SupportersClubTrip,
} from '@/features/casas/types';
import { ClubTripError } from '@/features/casas/types';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

// Casas and their trips. Every write is a database function; the amounts (free seats, due) come from the server.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

const KNOWN_REASONS: ClubTripErrorReason[] = [
  'wrong_club',
  'bad_member_code',
  'bookings_closed',
  'member_code_required',
  'already_in_car',
  'already_on_club_trip',
  'vehicle_not_empty',
];

/** Maps the message a Postgres function raised to a ClubTripError; anything unknown is 'other'. */
export function toClubTripError(error: { message: string }): ClubTripError {
  const reason = KNOWN_REASONS.find((known) => error.message === known) ?? 'other';
  return new ClubTripError(reason, error.message);
}

type Reply<T> = PromiseLike<{ data: T; error: { message: string } | null }>;

/** A call whose answer is used as it is (nothing, or something that may legitimately be null). */
async function run<T>(call: Reply<T>): Promise<T> {
  const { data, error } = await call;
  if (error) throw toClubTripError(error);
  return data;
}

/** A call that answers a list: no data is an empty list. */
async function rows<T>(call: Reply<T[] | null>): Promise<T[]> {
  return (await run(call)) ?? [];
}

/** A call that must answer something. */
async function required<T>(call: Reply<T | null>): Promise<T> {
  const data = await run(call);
  if (data === null) throw new ClubTripError('other', 'empty_response');
  return data;
}

// --- Row mappers (pure) -----------------------------------------------------------------------------------------

type TripListRow = Database['public']['Functions']['club_trips_for_fixture']['Returns'][number];
type SummaryRow = Database['public']['Functions']['club_trip_summary']['Returns'][number];
type MyBookingRow = Database['public']['Functions']['my_club_booking']['Returns'][number];

function bookingStatus(value: string | null): ClubBookingStatus | null {
  return value === 'booked' || value === 'waiting' || value === 'cancelled' ? value : null;
}

function tripStatus(value: string): ClubTripStatus {
  return value === 'closed' || value === 'cancelled' ? value : 'open';
}

function vehicleKind(value: string): ClubVehicleKind {
  return value === 'minibus' || value === 'carrinha' ? value : 'autocarro';
}

export function toClubTripListItem(row: TripListRow): ClubTripListItem {
  return {
    tripId: row.trip_id,
    clubId: row.club_id,
    clubName: row.club_name,
    municipalityName: row.municipality_name,
    firstStopName: row.first_stop_name,
    firstStopPassesAt: row.first_stop_passes_at,
    priceCents: row.price_cents,
    membersOnly: row.members_only,
    freeSeats: row.free_seats,
    distanceKm: row.distance_km,
    myStatus: bookingStatus(row.my_status),
  };
}

export function toVehicleSummary(row: SummaryRow): ClubTripVehicleSummary {
  return {
    vehicleId: row.vehicle_id,
    label: row.label,
    kind: vehicleKind(row.kind),
    seats: row.seats,
    occupied: row.occupied,
    waitingPeople: row.waiting_people,
    paidPeople: row.paid_people,
    dueCents: row.due_cents,
  };
}

export function toMyClubBooking(row: MyBookingRow): MyClubBooking {
  return {
    bookingId: row.booking_id,
    status: bookingStatus(row.status) ?? 'waiting',
    stopName: row.stop_name,
    passesAt: row.passes_at,
    vehicleLabel: row.vehicle_label,
    people: row.people,
    dueCents: row.due_cents,
    paid: row.paid,
    positionInWaiting: row.position_in_waiting,
  };
}

// --- Casas ------------------------------------------------------------------------------------------------------

const CLUB_COLUMNS = 'id, club_id, name, status, municipality:municipality_id (name)';

type ClubRow = {
  id: string;
  club_id: string;
  name: string;
  status: string;
  municipality: { name: string } | null;
};

function casaStatus(value: string): SupportersClubStatus {
  return value === 'verified' || value === 'suspended' ? value : 'pending';
}

function toSupportersClubs(
  rows: ClubRow[],
  roles: Map<string, SupportersClubRole>,
  followed: Set<string>
): SupportersClub[] {
  return rows.map((row) => ({
    id: row.id,
    clubId: row.club_id,
    name: row.name,
    municipalityName: row.municipality?.name ?? '',
    status: casaStatus(row.status),
    myRole: roles.get(row.id) ?? null,
    following: followed.has(row.id),
  }));
}

async function myRolesAndFollows(): Promise<{
  roles: Map<string, SupportersClubRole>;
  followed: Set<string>;
}> {
  // The manager policy shows every manager of my Casas, so filter on my own id.
  const { data: session } = await client().auth.getSession();
  const me = session.session?.user.id;
  if (!me) return { roles: new Map(), followed: new Set() };
  const [managers, follows] = await Promise.all([
    rows(client().from('supporters_club_manager').select('club_id, role').eq('profile_id', me)),
    rows(client().from('supporters_club_follower').select('club_id').eq('profile_id', me)),
  ]);
  const roles = new Map<string, SupportersClubRole>();
  for (const row of managers) roles.set(row.club_id, row.role === 'owner' ? 'owner' : 'manager');
  return { roles, followed: new Set(follows.map((row) => row.club_id)) };
}

/** The Casas I manage or follow. */
export async function fetchMySupportersClubs(): Promise<SupportersClub[]> {
  const { roles, followed } = await myRolesAndFollows();
  const ids = [...new Set([...roles.keys(), ...followed])];
  if (ids.length === 0) return [];
  const found = await rows(
    client().from('supporters_club').select(CLUB_COLUMNS).in('id', ids).order('name')
  );
  return toSupportersClubs(found, roles, followed);
}

export async function fetchSupportersClub(id: string): Promise<SupportersClub | null> {
  const { roles, followed } = await myRolesAndFollows();
  const row = await run(
    client().from('supporters_club').select(CLUB_COLUMNS).eq('id', id).maybeSingle()
  );
  if (!row) return null;
  const [club] = toSupportersClubs([row], roles, followed);
  return club ?? null;
}

/** Admins only (RLS): the Casas waiting for a decision. */
export async function fetchPendingSupportersClubs(): Promise<SupportersClub[]> {
  const found = await rows(
    client()
      .from('supporters_club')
      .select(CLUB_COLUMNS)
      .eq('status', 'pending')
      .order('created_at')
  );
  return toSupportersClubs(found, new Map(), new Set());
}

export async function requestSupportersClub(input: {
  clubId: string;
  name: string;
  municipalityId: string;
  contactEmail: string | null;
}): Promise<string> {
  return required(
    client().rpc('request_supporters_club', {
      p_club_id: input.clubId,
      p_name: input.name,
      p_municipality_id: input.municipalityId,
      p_contact_email: input.contactEmail ?? '',
    })
  );
}

export async function decideSupportersClub(
  id: string,
  status: 'verified' | 'suspended'
): Promise<void> {
  await run(client().rpc('decide_supporters_club', { p_id: id, p_status: status }));
}

export async function createSupportersClubInvite(clubId: string): Promise<string> {
  return required(client().rpc('create_supporters_club_invite', { p_club_id: clubId }));
}

/** Returns the id of the Casa the invite belongs to. */
export async function acceptSupportersClubInvite(code: string): Promise<string> {
  return required(client().rpc('accept_supporters_club_invite', { p_code: code }));
}

/** The managers of a Casa with their names, owner first; only its managers (and admins) get them. */
export async function fetchSupportersClubManagers(clubId: string): Promise<SupportersClubManager[]> {
  const [{ data: session }, managers] = await Promise.all([
    client().auth.getSession(),
    rows(client().rpc('supporters_club_managers', { p_club_id: clubId })),
  ]);
  const me = session.session?.user.id ?? null;
  return managers.map((row) => ({
    profileId: row.profile_id,
    name: row.display_name,
    role: row.role === 'owner' ? 'owner' : 'manager',
    isMe: row.profile_id === me,
  }));
}

/** The owner takes a manager out of the Casa. */
export async function removeSupportersClubManager(clubId: string, profileId: string): Promise<void> {
  await run(
    client().rpc('remove_supporters_club_manager', { p_club_id: clubId, p_profile_id: profileId })
  );
}

export async function setSupportersClubFollow(id: string, follow: boolean): Promise<void> {
  await run(client().rpc('set_supporters_club_follow', { p_id: id, p_follow: follow }));
}

/** The code «só sócios» trips ask for; managers only. */
export async function fetchMemberCode(clubId: string): Promise<string | null> {
  return run(client().rpc('supporters_club_member_code', { p_club_id: clubId }));
}

export async function rotateMemberCode(clubId: string): Promise<string> {
  return required(client().rpc('rotate_supporters_club_member_code', { p_club_id: clubId }));
}

// --- Trips ------------------------------------------------------------------------------------------------------

export async function createClubTrip(input: NewClubTrip): Promise<string> {
  return required(
    client().rpc('create_club_trip', {
      p_club_id: input.supportersClubId,
      p_fixture_id: input.fixtureId,
      p_name: input.name,
      p_price_cents: input.priceCents,
      p_members_only: input.membersOnly,
      p_bookings_close_at: input.bookingsCloseAt,
      p_note: input.note ?? '',
      p_stops: input.stops.map((stop) => ({
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        passes_at: stop.passesAt,
      })),
      p_vehicles: input.vehicles.map((vehicle: NewClubTripVehicle) => ({
        kind: vehicle.kind,
        label: vehicle.label,
        seats: vehicle.seats,
      })),
    })
  );
}

export async function addClubTripVehicle(
  tripId: string,
  vehicle: NewClubTripVehicle
): Promise<string> {
  return required(
    client().rpc('add_club_trip_vehicle', {
      p_trip_id: tripId,
      p_kind: vehicle.kind,
      p_label: vehicle.label,
      p_seats: vehicle.seats,
    })
  );
}

export async function updateClubTripVehicle(
  vehicleId: string,
  label: string,
  seats: number
): Promise<void> {
  await run(
    client().rpc('update_club_trip_vehicle', {
      p_vehicle_id: vehicleId,
      p_label: label,
      p_seats: seats,
    })
  );
}

export async function removeClubTripVehicle(vehicleId: string): Promise<void> {
  await run(client().rpc('remove_club_trip_vehicle', { p_vehicle_id: vehicleId }));
}

export async function setClubTripStatus(tripId: string, status: ClubTripStatus): Promise<void> {
  await run(
    client().rpc('set_club_trip_status', {
      p_trip_id: tripId,
      p_status: status,
    })
  );
}

export async function bookClubTrip(input: {
  tripId: string;
  stopId: string;
  companions: string[];
  memberCode: string | null;
}): Promise<ClubBookingStatus> {
  const row = await required(
    client().rpc('book_club_trip', {
      p_trip_id: input.tripId,
      p_stop_id: input.stopId,
      p_companions: input.companions,
      p_code: input.memberCode ?? '',
    })
  );
  return bookingStatus(row.status) ?? 'waiting';
}

export async function cancelMyClubBooking(bookingId: string): Promise<void> {
  await run(client().rpc('cancel_my_club_booking', { p_booking_id: bookingId }));
}

export async function addManualClubBooking(input: {
  tripId: string;
  name: string;
  stopId: string;
  companions: string[];
}): Promise<void> {
  await run(
    client().rpc('add_manual_club_booking', {
      p_trip_id: input.tripId,
      p_name: input.name,
      p_stop_id: input.stopId,
      p_companions: input.companions,
    })
  );
}

export async function manageClubBooking(
  bookingId: string,
  action: ManageBookingAction,
  vehicleId?: string
): Promise<void> {
  await run(
    client().rpc('manage_club_booking', {
      p_booking_id: bookingId,
      p_action: action,
      ...(vehicleId ? { p_vehicle_id: vehicleId } : {}),
    })
  );
}

export async function postClubTripNotice(tripId: string, body: string): Promise<string> {
  return required(client().rpc('post_club_trip_notice', { p_trip_id: tripId, p_body: body }));
}

// --- Reads ------------------------------------------------------------------------------------------------------

export async function fetchClubTripsForFixture(fixtureId: string): Promise<ClubTripListItem[]> {
  const found = await rows(client().rpc('club_trips_for_fixture', { p_fixture_id: fixtureId }));
  return found.map(toClubTripListItem);
}

export async function fetchClubTripSummary(tripId: string): Promise<ClubTripVehicleSummary[]> {
  const found = await rows(client().rpc('club_trip_summary', { p_trip_id: tripId }));
  return found.map(toVehicleSummary);
}

export async function fetchMyClubBooking(tripId: string): Promise<MyClubBooking | null> {
  const found = await rows(client().rpc('my_club_booking', { p_trip_id: tripId }));
  const [first] = found;
  return first ? toMyClubBooking(first) : null;
}

/** The trip, its stops, the vehicles with their counts, and my booking. */
async function loadClubTrip(tripId: string) {
  return await Promise.all([
    run(
      client()
        .from('club_trip')
        .select(
          'id, supporters_club_id, fixture_id, name, price_cents, members_only, bookings_close_at, note, status'
        )
        .eq('id', tripId)
        .maybeSingle()
    ),
    rows(
      client()
        .from('club_trip_stop')
        .select('id, position, name, passes_at')
        .eq('trip_id', tripId)
        .order('position')
    ),
    fetchClubTripSummary(tripId),
    fetchMyClubBooking(tripId),
  ]);
}

export async function fetchClubTrip(tripId: string): Promise<ClubTripFull | null> {
  let loaded;
  try {
    loaded = await loadClubTrip(tripId);
  } catch (error) {
    // A trip I cannot see (hidden Casa, wrong id) is not an error, it is just not there.
    if (error instanceof ClubTripError && error.message === 'trip_not_found') return null;
    throw error;
  }
  const [trip, stops, summary, myBooking] = loaded;
  if (!trip) return null;
  return {
    trip: {
      id: trip.id,
      supportersClubId: trip.supporters_club_id,
      fixtureId: trip.fixture_id,
      name: trip.name,
      priceCents: trip.price_cents,
      membersOnly: trip.members_only,
      bookingsCloseAt: trip.bookings_close_at,
      note: trip.note,
      status: tripStatus(trip.status),
    },
    stops: stops.map((stop) => ({
      id: stop.id,
      position: stop.position,
      name: stop.name,
      passesAt: stop.passes_at,
    })),
    summary,
    myBooking,
  };
}

/** The passenger list; only the Casa's managers get it. */
export async function fetchClubTripBookings(tripId: string): Promise<ClubBooking[]> {
  const [bookings, stops] = await Promise.all([
    rows(client().rpc('club_trip_bookings', { p_trip_id: tripId })),
    rows(client().from('club_trip_stop').select('id, name').eq('trip_id', tripId)),
  ]);
  const stopNames = new Map(stops.map((stop) => [stop.id, stop.name]));
  return bookings.map((row) => ({
    id: row.booking_id,
    name: row.display_name,
    isManual: row.is_manual,
    stopName: stopNames.get(row.stop_id) ?? '',
    vehicleId: row.vehicle_id,
    people: row.people,
    companions: row.companions,
    status: bookingStatus(row.status) ?? 'waiting',
    paid: row.paid,
    boarded: row.boarded,
  }));
}

type CasaTripRow = {
  id: string;
  fixture_id: string;
  name: string;
  price_cents: number;
  members_only: boolean;
  status: string;
  fixture: { kickoff_at: string } | null;
};

export function toSupportersClubTrip(row: CasaTripRow): SupportersClubTrip | null {
  if (!row.fixture) return null;
  return {
    id: row.id,
    fixtureId: row.fixture_id,
    kickoffAt: row.fixture.kickoff_at,
    name: row.name,
    priceCents: row.price_cents,
    membersOnly: row.members_only,
    status: tripStatus(row.status),
  };
}

/** The Casa's upcoming trips (not cancelled, game not started yet), soonest game first. */
export async function fetchSupportersClubTrips(clubId: string): Promise<SupportersClubTrip[]> {
  const found = await rows(
    client()
      .from('club_trip')
      .select(
        'id, fixture_id, name, price_cents, members_only, status, fixture:fixture_id!inner (kickoff_at)'
      )
      .eq('supporters_club_id', clubId)
      .neq('status', 'cancelled')
      .gt('fixture.kickoff_at', new Date().toISOString())
  );
  return found
    .map(toSupportersClubTrip)
    .filter((trip): trip is SupportersClubTrip => trip !== null)
    .sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt));
}

export async function fetchClubTripNotices(tripId: string): Promise<ClubTripNotice[]> {
  const found = await rows(
    client()
      .from('club_trip_notice')
      .select('id, body, created_at')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
  );
  return found.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
  }));
}
