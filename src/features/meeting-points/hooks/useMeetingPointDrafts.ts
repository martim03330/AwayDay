import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { approveDraft, dismissDraft, fetchPendingDrafts } from '@/features/meeting-points/api';
import type { DraftFields } from '@/features/meeting-points/types';

const DRAFTS_KEY = ['meeting-point-drafts'] as const;

/** Pending drafts, for admins only; never persisted on the phone. */
export function usePendingDrafts(enabled: boolean) {
  return useQuery({
    queryKey: DRAFTS_KEY,
    queryFn: enabled ? fetchPendingDrafts : skipToken,
    staleTime: 60 * 1000,
    meta: { persist: false },
  });
}

/** Publish or dismiss a draft; refreshes the drafts and the fixtures catalogue (where meeting points live). */
export function useDecideDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      decision:
        | { draftId: string; action: 'approve'; fields: DraftFields }
        | { draftId: string; action: 'dismiss' }
    ) =>
      decision.action === 'approve'
        ? approveDraft(decision.draftId, decision.fields)
        : dismissDraft(decision.draftId).then(() => ({ located: false })),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: DRAFTS_KEY }),
        queryClient.invalidateQueries({ queryKey: ['fixtures', 'catalog'] }),
      ]),
  });
}
