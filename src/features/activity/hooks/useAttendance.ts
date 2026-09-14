import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchAttendance, fetchMyAttendance, setGoing } from '@/features/activity/api';

const ATTENDANCE_KEY = 'attendance';

/** The signed-in user's attendance for a fixture; idle while signed out. */
export function useAttendance(userId: string | null, fixtureId: string) {
  return useQuery({
    queryKey: [ATTENDANCE_KEY, userId, fixtureId],
    queryFn: userId ? () => fetchAttendance(userId, fixtureId) : skipToken,
    staleTime: 60 * 1000,
  });
}

/** All of the signed-in user's attendance, by fixture id; idle while signed out. */
export function useMyAttendance(userId: string | null) {
  return useQuery({
    queryKey: [ATTENDANCE_KEY, userId],
    queryFn: userId ? () => fetchMyAttendance(userId) : skipToken,
    staleTime: 60 * 1000,
  });
}

export function useSetGoing(userId: string | null, fixtureId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (going: boolean) => {
      if (!userId) throw new Error('Not signed in.');
      return setGoing(userId, fixtureId, going);
    },
    // The prefix covers this fixture and the full list.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ATTENDANCE_KEY, userId] }),
  });
}
