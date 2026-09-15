/**
 * Mensagem do treinador ao abrir a app (padrão wrapper). Não desenha nada: os ecrãs leem `useAICoach()`.
 * - Com mensagem guardada para o contexto atual, mostra-a logo, sem pedir nada ao servidor.
 * - Sem mensagem e com contexto que o justifique, pede-a em segundo plano (`loading`).
 * - Sem contexto, sem conta ou com as sugestões desligadas, fica calada.
 * - `destino`: o ecrã que a dica abre ao tocar (o tasco do check-in, o jogo ou o passaporte).
 */

import type { Href } from 'expo-router';
import { createContext, use, type ReactNode } from 'react';

import { localCoachContext } from '@/features/coach/context';
import { useCoachMessage } from '@/features/coach/hooks/useCoachMessage';
import type { CoachMessage } from '@/features/coach/types';
import { useMyProfile } from '@/features/profile/hooks/useMyProfile';
import { useNow } from '@/hooks/use-now';
import { useUserId } from '@/lib/session';
import { jogos, obterJogo } from '@/mocks/jogos';
import type { VisitaLocal } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';

type AICoach = {
  message: CoachMessage | null;
  loading: boolean;
  destino: Href | null;
};

const CALADA: AICoach = { message: null, loading: false, destino: null };
const MINUTO_MS = 60 * 1000;

const AICoachContext = createContext<AICoach>(CALADA);

function destinoDaDica(message: CoachMessage, ultimoCheckIn: VisitaLocal | undefined): Href | null {
  if (message.kind === 'checkin_ativo') {
    return ultimoCheckIn
      ? { pathname: '/locais/[localId]', params: { localId: ultimoCheckIn.localId } }
      : null;
  }
  if (message.kind === 'marco_passaporte') return '/perfil/passaporte';
  if (message.fixtureId && obterJogo(message.fixtureId)) {
    return { pathname: '/jogos/[jogoId]', params: { jogoId: message.fixtureId } };
  }
  return null;
}

export function AICoachProvider({ children }: { children: ReactNode }) {
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  // A fase do dia de jogo muda aos minutos: basta acordar uma vez por minuto.
  const agora = useNow(MINUTO_MS);
  const { clubeFavoritoId, clubeDaTerraId, estadiosVisitados, visitasLocais, fezCheckIn } = useAppState();

  // As visitas estão da mais recente para a mais antiga.
  const ultimoCheckIn = visitasLocais.find(
    (visita) => visita.origem === 'check-in' && fezCheckIn(visita.localId)
  );
  const contexto = userId
    ? localCoachContext({
        userId,
        now: agora,
        supporterClubId: clubeFavoritoId,
        hometownClubId: clubeDaTerraId,
        fixtures: jogos,
        visitedVenueIds: estadiosVisitados,
        lastCheckIn: ultimoCheckIn ? { id: ultimoCheckIn.id, at: Date.parse(ultimoCheckIn.data) } : null,
      })
    : null;
  const pedir = perfil.data?.nudgesEnabled === true && contexto !== null && contexto.worthAsking;
  const mensagem = useCoachMessage(contexto?.key ?? null, pedir, agora);
  const message = mensagem.data ?? null;

  const value: AICoach = pedir
    ? {
        message,
        loading: mensagem.data === undefined && mensagem.isFetching,
        destino: message ? destinoDaDica(message, ultimoCheckIn) : null,
      }
    : CALADA;

  return <AICoachContext value={value}>{children}</AICoachContext>;
}

export function useAICoach() {
  return use(AICoachContext);
}
