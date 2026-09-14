import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchNotificationPreferences } from '@/features/profile/api';

export const notificationPreferencesKey = (userId: string | null) =>
  ['notification-preferences', userId] as const;

export function useNotificationPreferences(userId: string | null) {
  return useQuery({
    queryKey: notificationPreferencesKey(userId),
    queryFn: userId ? () => fetchNotificationPreferences(userId) : skipToken,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRefreshNotificationPreferences(userId: string | null) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: notificationPreferencesKey(userId) });
}
