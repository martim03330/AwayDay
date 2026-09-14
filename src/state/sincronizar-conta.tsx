import { useEffect, useRef } from 'react';

import { useForgetProfiles, useMyProfile, useSaveProfileClub } from '@/features/profile/hooks/useMyProfile';
import { useSession, useUserId } from '@/lib/session';
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
 * - Ao sair: esquece o perfil guardado em cache, para a próxima pessoa não o ver.
 */
export function SincronizarConta() {
  const sessao = useSession();
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  const guardarClube = useSaveProfileClub(userId);
  const esquecerPerfis = useForgetProfiles();
  const {
    introducaoVista,
    onboardingConcluido,
    clubeFavoritoId,
    clubeDaTerraId,
    escolherClube,
    confirmarClubeDaTerra,
    saltarOnboarding,
  } = useAppState();
  const reconciliacao = useRef<Reconciliacao | null>(null);

  useEffect(() => {
    if (sessao.status !== 'signed-out') return;
    reconciliacao.current = null;
    esquecerPerfis();
  }, [sessao.status, esquecerPerfis]);

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

    const clubeDiferente = clubeFavoritoId !== dados.supporterClubId;
    const terraDiferente = clubeDaTerraId !== null && clubeDaTerraId !== dados.hometownClubId;

    if (estado.aEsperarPeloTelemovel) {
      if (clubeDiferente || terraDiferente) return;
      estado.aEsperarPeloTelemovel = false;
      return;
    }

    if (clubeDiferente) {
      guardarClube.mutate({ relation: 'supporter', clubId: clubeFavoritoId });
    } else if (terraDiferente) {
      guardarClube.mutate({ relation: 'hometown', clubId: clubeDaTerraId });
    }
  }, [userId, perfil.data, clubeFavoritoId, clubeDaTerraId, guardarClube]);

  return null;
}
