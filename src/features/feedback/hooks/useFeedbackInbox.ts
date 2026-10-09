import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchFeedbackInbox, setFeedbackStatus, type FeedbackItem } from '@/features/feedback/api';

export type FeedbackStatus = FeedbackItem['status'];

export const feedbackInboxKey = (status: FeedbackStatus) => ['feedback', 'inbox', status] as const;

/** The admins' inbox for one status. Idle for everyone else (the RPC would return nothing anyway). */
export function useFeedbackInbox(isAdmin: boolean, status: FeedbackStatus) {
  return useQuery({
    queryKey: feedbackInboxKey(status),
    queryFn: isAdmin ? () => fetchFeedbackInbox(status) : skipToken,
    staleTime: 30 * 1000,
    meta: { persist: false },
  });
}

export function useSetFeedbackStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: FeedbackStatus }) =>
      setFeedbackStatus(id, status),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['feedback', 'inbox'] }),
  });
}
