import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { fixtureCatalogQuery } from '@/features/fixtures/hooks/useFixtureCatalog';
import { useMyProfile, useSaveProfileClub } from '@/features/profile/hooks/useMyProfile';
import { useSession, useUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useAppState } from '@/state/app-state';

type Reconciliacao = {
  userId: string;
  /** A conta ganhou: espera que as escolhas no telemóvel fiquem iguais antes de voltar a guardar. */
  aEsperarPeloTelemovel: boolean;
};

/**
 * Liga as escolhas de clube à conta. Não desenha nada.
 * - Ao entrar: se a conta já tem clube, é a conta que manda (e salta a introdução); se não tem,
 *   guarda na conta o que foi escolhido neste telemóvel.
 * - Depois disso, cada mudança feita no telemóvel é guardada na conta.
 * - Ao sair (ou depois de apagar a conta): esquece tudo o que a conta deixou na cache guardada no telemóvel
 *   (perfil, dicas, retrospetiva, presenças), para a próxima pessoa não o ver. Só o catálogo de jogos fica.
 */
export function SincronizarConta() {
  const queryClient = useQueryClient();
  const sessao = useSession();
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  const guardarClube = useSaveProfileClub(userId);
  const {
    introducaoVista,
    onboardingConcluido,
    clubeFavoritoId,
    clubeDaTerraId,
    escolherClube,
    confirmarClubeDaTerra,
    saltarOnboarding,
    reverIntroducao,
    modoDemo,
  } = useAppState();
  const reconciliacao = useRef<Reconciliacao | null>(null);

  useEffect(() => {
    if (sessao.status !== 'signed-out') return;
    reconciliacao.current = null;
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== fixtureCatalogQuery.queryKey[0],
    });
  }, [sessao.status, queryClient]);

  // The app is only used with an account: without one it goes back to the start. Signing in again to an account that
  // has a club skips the steps (below); one without a club goes through them. Demo mode is the exception. Runs once:
  // after it, the introduction is no longer marked as done.
  useEffect(() => {
    if (sessao.status === 'signed-out' && onboardingConcluido && !modoDemo && supabase) reverIntroducao();
  }, [sessao.status, onboardingConcluido, modoDemo, reverIntroducao]);

  useEffect(() => {
    const dados = perfil.data;
    if (!userId || !dados || reconciliacao.current?.userId === userId) return;

    if (dados.supporterClubId) {
      escolherClube(dados.supporterClubId);
      // É a escolha já confirmada pela própria pessoa noutra altura, não uma sugestão.
      if (dados.hometownClubId) confirmarClubeDaTerra(dados.hometownClubId);
      if (!onboardingConcluido) saltarOnboarding();
      reconciliacao.current = { userId, aEsperarPeloTelemovel: true };
      return;
    }

    // Conta nova: só guarda depois de a pessoa ter escolhido mesmo um clube na introdução.
    if (!introducaoVista) return;
    reconciliacao.current = { userId, aEsperarPeloTelemovel: false };
  }, [
    userId,
    perfil.data,
    introducaoVista,
    onboardingConcluido,
    escolherClube,
    confirmarClubeDaTerra,
    saltarOnboarding,
  ]);

  useEffect(() => {
    const dados = perfil.data;
    const estado = reconciliacao.current;
    if (!userId || !dados || estado?.userId !== userId || guardarClube.isPending) return;

    // Sem clube escolhido no telemóvel não há nada para guardar (nunca se inventa um).
    const clubeDiferente = clubeFavoritoId !== null && clubeFavoritoId !== dados.supporterClubId;
    const terraDiferente = clubeDaTerraId !== null && clubeDaTerraId !== dados.hometownClubId;

    if (estado.aEsperarPeloTelemovel) {
      if (clubeDiferente || terraDiferente) return;
      estado.aEsperarPeloTelemovel = false;
      return;
    }

    if (clubeDiferente && clubeFavoritoId !== null) {
      guardarClube.mutate({ relation: 'supporter', clubId: clubeFavoritoId });
    } else if (terraDiferente) {
      guardarClube.mutate({ relation: 'hometown', clubId: clubeDaTerraId });
    }
  }, [userId, perfil.data, clubeFavoritoId, clubeDaTerraId, guardarClube]);

  return null;
}
