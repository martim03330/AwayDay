import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: null }));

const { toClubTripError, toMyClubBooking, toVehicleSummary } =
  await import("@/features/casas/api");

describe("toClubTripError", () => {
  it("keeps the reasons the screens react to", () => {
    for (const reason of [
      "wrong_club",
      "bookings_closed",
      "member_code_required",
      "already_in_car",
      "already_on_club_trip",
      "vehicle_not_empty",
    ] as const) {
      expect(toClubTripError({ message: reason }).reason).toBe(reason);
    }
  });

  it("turns anything else into other", () => {
    expect(toClubTripError({ message: "bad_stop" }).reason).toBe("other");
    expect(toClubTripError({ message: "" }).reason).toBe("other");
  });
});

describe("row mappers", () => {
  it("keeps money as integer cents", () => {
    const booking = toMyClubBooking({
      booking_id: "b",
      status: "booked",
      stop_name: "Sede",
      passes_at: "2026-11-01T10:00:00Z",
      vehicle_label: "Autocarro 1",
      people: 4,
      due_cents: 2720,
      paid: false,
      position_in_waiting: 0,
    });
    expect(booking.dueCents).toBe(2720);
    expect(Number.isInteger(booking.dueCents)).toBe(true);
  });

  it("maps the vehicle summary", () => {
    const summary = toVehicleSummary({
      vehicle_id: "v",
      label: "A",
      kind: "minibus",
      seats: 16,
      occupied: 3,
      waiting_people: 2,
      paid_people: 1,
      due_cents: 1360,
    });
    expect(summary).toMatchObject({
      kind: "minibus",
      waitingPeople: 2,
      paidPeople: 1,
      dueCents: 1360,
    });
  });
});
