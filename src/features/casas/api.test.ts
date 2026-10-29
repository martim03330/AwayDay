import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: null }));

const { toClubTripError, toMyClubBooking, toSupportersClubTrip, toVehicleSummary } = await import(
  '@/features/casas/api'
);

describe('toClubTripError', () => {
  it('keeps the reasons the screens react to', () => {
    for (const reason of [
      'wrong_club',
      'bookings_closed',
      'member_code_required',
      'already_in_car',
      'already_on_club_trip',
      'vehicle_not_empty',
    ] as const) {
      expect(toClubTripError({ message: reason }).reason).toBe(reason);
    }
  });

  it('turns anything else into other', () => {
    expect(toClubTripError({ message: 'bad_stop' }).reason).toBe('other');
    expect(toClubTripError({ message: '' }).reason).toBe('other');
  });
});

describe('row mappers', () => {
  it('keeps money as integer cents', () => {
    const booking = toMyClubBooking({
      booking_id: 'b',
      status: 'booked',
      stop_name: 'Sede',
      passes_at: '2026-11-01T10:00:00Z',
      vehicle_label: 'Autocarro 1',
      people: 4,
      due_cents: 2720,
      paid: false,
      position_in_waiting: 0,
    });
    expect(booking.dueCents).toBe(2720);
    expect(Number.isInteger(booking.dueCents)).toBe(true);
  });

  it('maps the vehicle summary', () => {
    const summary = toVehicleSummary({
      vehicle_id: 'v',
      label: 'A',
      kind: 'minibus',
      seats: 16,
      occupied: 3,
      waiting_people: 2,
      paid_people: 1,
      due_cents: 1360,
    });
    expect(summary).toMatchObject({
      kind: 'minibus',
      waitingPeople: 2,
      paidPeople: 1,
      dueCents: 1360,
    });
  });
});

describe('toSupportersClubTrip', () => {
  const row = {
    id: 't1',
    fixture_id: 'f1',
    name: 'Autocarro da sede',
    price_cents: 1250,
    members_only: true,
    status: 'closed',
    fixture: { kickoff_at: '2026-11-08T20:30:00Z' },
  };

  it('keeps the price in cents and the game kick-off in UTC', () => {
    expect(toSupportersClubTrip(row)).toEqual({
      id: 't1',
      fixtureId: 'f1',
      kickoffAt: '2026-11-08T20:30:00Z',
      name: 'Autocarro da sede',
      priceCents: 1250,
      membersOnly: true,
      status: 'closed',
    });
  });

  it('drops a row without its game, and reads an unknown status as open', () => {
    expect(toSupportersClubTrip({ ...row, fixture: null })).toBeNull();
    expect(toSupportersClubTrip({ ...row, status: '?' })?.status).toBe('open');
  });
});
