// Casas (supporters' clubs) and their trips. Amounts are integer cents and are always computed by the server.

export type SupportersClubStatus = "pending" | "verified" | "suspended";
export type SupportersClubRole = "owner" | "manager";

export type SupportersClub = {
  id: string;
  clubId: string;
  name: string;
  municipalityName: string;
  status: SupportersClubStatus;
  /** My role in this Casa, or null when I only follow it (or neither). */
  myRole: SupportersClubRole | null;
  following: boolean;
};

export type ClubTripStatus = "open" | "closed" | "cancelled";
export type ClubBookingStatus = "booked" | "waiting" | "cancelled";
export type ClubVehicleKind = "autocarro" | "minibus" | "carrinha";

/** One row of `club_trips_for_fixture`. */
export type ClubTripListItem = {
  tripId: string;
  clubId: string;
  clubName: string;
  municipalityName: string;
  firstStopName: string;
  firstStopPassesAt: string;
  priceCents: number;
  membersOnly: boolean;
  freeSeats: number;
  distanceKm: number | null;
  myStatus: ClubBookingStatus | null;
};

/** One row of `club_trip_summary`: a vehicle with what is in it. */
export type ClubTripVehicleSummary = {
  vehicleId: string;
  label: string;
  kind: ClubVehicleKind;
  seats: number;
  occupied: number;
  waitingPeople: number;
  paidPeople: number;
  dueCents: number;
};

export type ClubTripStop = {
  id: string;
  position: number;
  name: string;
  passesAt: string;
};

export type ClubTripDetails = {
  id: string;
  supportersClubId: string;
  fixtureId: string;
  name: string;
  priceCents: number;
  membersOnly: boolean;
  bookingsCloseAt: string;
  note: string | null;
  status: ClubTripStatus;
};

/** One row of `my_club_booking`. */
export type MyClubBooking = {
  bookingId: string;
  status: ClubBookingStatus;
  stopName: string;
  passesAt: string;
  vehicleLabel: string | null;
  people: number;
  dueCents: number;
  paid: boolean;
  positionInWaiting: number | null;
};

/** A booking as the Casa's managers see it. */
export type ClubBooking = {
  id: string;
  name: string;
  isManual: boolean;
  stopName: string;
  vehicleId: string | null;
  people: number;
  companions: string[];
  status: ClubBookingStatus;
  paid: boolean;
  boarded: boolean;
};

export type ClubTripNotice = {
  id: string;
  body: string;
  createdAt: string;
};

export type ClubTripFull = {
  trip: ClubTripDetails;
  stops: ClubTripStop[];
  summary: ClubTripVehicleSummary[];
  myBooking: MyClubBooking | null;
};

export type ClubTripErrorReason =
  | "wrong_club"
  | "bookings_closed"
  | "member_code_required"
  | "already_in_car"
  | "already_on_club_trip"
  | "vehicle_not_empty"
  | "other";

export class ClubTripError extends Error {
  readonly reason: ClubTripErrorReason;

  constructor(reason: ClubTripErrorReason, message?: string) {
    super(message ?? reason);
    this.name = "ClubTripError";
    this.reason = reason;
  }
}

export type NewClubTripStop = {
  name: string;
  lat: number;
  lng: number;
  passesAt: string;
};
export type NewClubTripVehicle = {
  kind: ClubVehicleKind;
  label: string;
  seats: number;
};

export type NewClubTrip = {
  supportersClubId: string;
  fixtureId: string;
  name: string;
  priceCents: number;
  membersOnly: boolean;
  bookingsCloseAt: string;
  note: string | null;
  stops: NewClubTripStop[];
  vehicles: NewClubTripVehicle[];
};

export type ManageBookingAction =
  "move" | "paid" | "unpaid" | "boarded" | "not_boarded" | "remove";
