import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  acceptSupportersClubInvite,
  createSupportersClubInvite,
  decideSupportersClub,
  fetchMemberCode,
  fetchMySupportersClubs,
  fetchPendingSupportersClubs,
  fetchSupportersClub,
  requestSupportersClub,
  rotateMemberCode,
  setSupportersClubFollow,
} from "@/features/casas/api";
import type { SupportersClub } from "@/features/casas/types";

export const CASAS_KEY = "casas";
const STALE_MS = 60 * 1000;

export const myCasasKey = () => [CASAS_KEY, "mine"] as const;
export const casaKey = (id: string | null) => [CASAS_KEY, "one", id] as const;
export const pendingCasasKey = () => [CASAS_KEY, "pending"] as const;
export const memberCodeKey = (id: string | null) =>
  [CASAS_KEY, "member-code", id] as const;

export function useMySupportersClubs() {
  return useQuery({
    queryKey: myCasasKey(),
    queryFn: fetchMySupportersClubs,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

export function useSupportersClub(id: string | null) {
  return useQuery({
    queryKey: casaKey(id),
    queryFn: id ? () => fetchSupportersClub(id) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/** Admins only; for anyone else RLS returns nothing. */
export function usePendingSupportersClubs(enabled = true) {
  return useQuery({
    queryKey: pendingCasasKey(),
    queryFn: enabled ? fetchPendingSupportersClubs : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

/** The code «só sócios» trips ask for; managers only. */
export function useMemberCode(clubId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: memberCodeKey(clubId),
    queryFn: clubId && enabled ? () => fetchMemberCode(clubId) : skipToken,
    staleTime: STALE_MS,
    meta: { persist: false },
  });
}

function useInvalidateCasas() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [CASAS_KEY] });
}

export function useRequestSupportersClub() {
  const invalidate = useInvalidateCasas();
  return useMutation({
    mutationFn: requestSupportersClub,
    onSettled: invalidate,
  });
}

export function useDecideSupportersClub() {
  const invalidate = useInvalidateCasas();
  return useMutation({
    mutationFn: (input: { id: string; status: "verified" | "suspended" }) =>
      decideSupportersClub(input.id, input.status),
    onSettled: invalidate,
  });
}

export function useCreateSupportersClubInvite() {
  return useMutation({ mutationFn: createSupportersClubInvite });
}

export function useAcceptSupportersClubInvite() {
  const invalidate = useInvalidateCasas();
  return useMutation({
    mutationFn: acceptSupportersClubInvite,
    onSettled: invalidate,
  });
}

export function useRotateMemberCode() {
  const invalidate = useInvalidateCasas();
  return useMutation({ mutationFn: rotateMemberCode, onSettled: invalidate });
}

/** Following is optimistic: the flag flips right away and goes back if the server refuses. */
export function useSetSupportersClubFollow() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCasas();
  return useMutation({
    mutationFn: (input: { id: string; follow: boolean }) =>
      setSupportersClubFollow(input.id, input.follow),
    onMutate: async ({ id, follow }) => {
      await queryClient.cancelQueries({ queryKey: [CASAS_KEY] });
      const previousOne = queryClient.getQueryData<SupportersClub | null>(
        casaKey(id),
      );
      if (previousOne) {
        queryClient.setQueryData(casaKey(id), {
          ...previousOne,
          following: follow,
        });
      }
      return { previousOne };
    },
    onError: (_error, { id }, context) => {
      if (context?.previousOne)
        queryClient.setQueryData(casaKey(id), context.previousOne);
    },
    onSettled: invalidate,
  });
}
