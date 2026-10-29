import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  addClubTripVehicle,
  addManualClubBooking,
  bookClubTrip,
  cancelMyClubBooking,
  createClubTrip,
  fetchClubTrip,
  fetchClubTripBookings,
  fetchClubTripNotices,
  fetchClubTripsForFixture,
  manageClubBooking,
  postClubTripNotice,
  removeClubTripVehicle,
  setClubTripStatus,
  updateClubTripVehicle,
} from "@/features/casas/api";
import { CASAS_KEY } from "@/features/casas/hooks/useCasas";
import type {
  ClubTripFull,
  ClubTripListItem,
  ClubTripStatus,
  ManageBookingAction,
  NewClubTripVehicle,
} from "@/features/casas/types";

const STALE_MS = 30 * 1000;

export const clubTripsForFixtureKey = (fixtureId: string | null) =>
  [CASAS_KEY, "trips", "fixture", fixtureId] as const;
export const clubTripKey = (tripId: string | null) =>
  [CASAS_KEY, "trips", "one", tripId] as const;
export const clubTripBookingsKey = (tripId: string | null) =>
  [CASAS_KEY, "trips", "bookings", tripId] as const;
export const clubTripNoticesKey = (tripId: string | null) =>
  [CASAS_KEY, "trips", "notices", tripId] as const;

export function useClubTripsForFixture(
  fixtureId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: clubTripsForFixtureKey(fixtureId),
    queryFn:
      fixtureId && enabled
        ? () => fetchClubTripsForFixture(fixtureId)
        : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/** The trip with its stops, vehicles (with counts) and my booking. */
export function useClubTrip(tripId: string | null) {
  return useQuery({
    queryKey: clubTripKey(tripId),
    queryFn: tripId ? () => fetchClubTrip(tripId) : skipToken,
    staleTime: STALE_MS,
    refetchInterval: 60 * 1000,
    meta: { persist: false },
  });
}

/** The passenger list: managers only (RLS). */
export function useClubTripBookings(tripId: string | null, enabled = true) {
  return useQuery({
    queryKey: clubTripBookingsKey(tripId),
    queryFn:
      tripId && enabled ? () => fetchClubTripBookings(tripId) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

export function useClubTripNotices(tripId: string | null) {
  return useQuery({
    queryKey: clubTripNoticesKey(tripId),
    queryFn: tripId ? () => fetchClubTripNotices(tripId) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

function useInvalidateCasas() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [CASAS_KEY] });
}

export function useCreateClubTrip() {
  const invalidate = useInvalidateCasas();
  return useMutation({ mutationFn: createClubTrip, onSettled: invalidate });
}

export function useAddClubTripVehicle() {
  const invalidate = useInvalidateCasas();
  return useMutation({
    mutationFn: (input: { tripId: string; vehicle: NewClubTripVehicle }) =>
      addClubTripVehicle(input.tripId, input.vehicle),
    onSettled: invalidate,
  });
}

export function useUpdateClubTripVehicle() {
  const invalidate = useInvalidateCasas();
  return useMutation({
    mutationFn: (input: { vehicleId: string; label: string; seats: number }) =>
      updateClubTripVehicle(input.vehicleId, input.label, input.seats),
    onSettled: invalidate,
  });
}

export function useRemoveClubTripVehicle() {
  const invalidate = useInvalidateCasas();
  return useMutation({
    mutationFn: removeClubTripVehicle,
    onSettled: invalidate,
  });
}

export function useSetClubTripStatus() {
  const invalidate = useInvalidateCasas();
  return useMutation({
    mutationFn: (input: { tripId: string; status: ClubTripStatus }) =>
      setClubTripStatus(input.tripId, input.status),
    onSettled: invalidate,
  });
}

export function useAddManualClubBooking() {
  const invalidate = useInvalidateCasas();
  return useMutation({
    mutationFn: addManualClubBooking,
    onSettled: invalidate,
  });
}

export function useManageClubBooking() {
  const invalidate = useInvalidateCasas();
  return useMutation({
    mutationFn: (input: {
      bookingId: string;
      action: ManageBookingAction;
      vehicleId?: string;
    }) => manageClubBooking(input.bookingId, input.action, input.vehicleId),
    onSettled: invalidate,
  });
}

export function usePostClubTripNotice() {
  const invalidate = useInvalidateCasas();
  return useMutation({
    mutationFn: (input: { tripId: string; body: string }) =>
      postClubTripNotice(input.tripId, input.body),
    onSettled: invalidate,
  });
}

/**
 * Booking is optimistic: the trip shows a booking right away (a seat taken, or the waiting list — the server decides,
 * and the refetch after it corrects the guess); everything goes back if the server refuses.
 */
export function useBookClubTrip(fixtureId: string | null) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCasas();
  return useMutation({
    mutationFn: bookClubTrip,
    onMutate: async (input) => {
      const tripKey = clubTripKey(input.tripId);
      const listKey = clubTripsForFixtureKey(fixtureId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: tripKey }),
        queryClient.cancelQueries({ queryKey: listKey }),
      ]);
      const previousTrip = queryClient.getQueryData<ClubTripFull | null>(
        tripKey,
      );
      const previousList =
        queryClient.getQueryData<ClubTripListItem[]>(listKey);
      queryClient.setQueryData<ClubTripListItem[]>(listKey, (items) =>
        items?.map((item) =>
          item.tripId === input.tripId
            ? {
                ...item,
                myStatus:
                  item.freeSeats > input.companions.length
                    ? "booked"
                    : "waiting",
              }
            : item,
        ),
      );
      return { previousTrip, previousList, tripKey, listKey };
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      queryClient.setQueryData(context.tripKey, context.previousTrip);
      queryClient.setQueryData(context.listKey, context.previousList);
    },
    onSettled: invalidate,
  });
}

/** Cancelling is optimistic too: my booking disappears at once and comes back if the server refuses. */
export function useCancelMyClubBooking(
  tripId: string | null,
  fixtureId: string | null,
) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCasas();
  return useMutation({
    mutationFn: cancelMyClubBooking,
    onMutate: async () => {
      const tripKey = clubTripKey(tripId);
      const listKey = clubTripsForFixtureKey(fixtureId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: tripKey }),
        queryClient.cancelQueries({ queryKey: listKey }),
      ]);
      const previousTrip = queryClient.getQueryData<ClubTripFull | null>(
        tripKey,
      );
      const previousList =
        queryClient.getQueryData<ClubTripListItem[]>(listKey);
      queryClient.setQueryData<ClubTripFull | null>(tripKey, (current) =>
        current ? { ...current, myBooking: null } : current,
      );
      queryClient.setQueryData<ClubTripListItem[]>(listKey, (items) =>
        items?.map((item) =>
          item.tripId === tripId ? { ...item, myStatus: null } : item,
        ),
      );
      return { previousTrip, previousList, tripKey, listKey };
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      queryClient.setQueryData(context.tripKey, context.previousTrip);
      queryClient.setQueryData(context.listKey, context.previousList);
    },
    onSettled: invalidate,
  });
}
