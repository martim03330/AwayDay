import { useMyAttendance } from '@/features/activity/hooks/useAttendance';
import { useNow } from '@/hooks/use-now';
import { estadoDoJogo } from '@/lib/jogos';
import { useUserId } from '@/lib/session';
import { jogos } from '@/mocks/jogos';
import { useAppState } from '@/state/app-state';

/**
 * Fixtures the user went to: marked "going" or attended on their account, or reviewed on this phone.
 * `historico` holds the finished ones, newest first.
 */
export function useJogosAQueFoste() {
  const agora = useNow();
  const userId = useUserId();
  const presencas = useMyAttendance(userId);
  const { avaliacaoDoJogo } = useAppState();

  const foste = (jogoId: string) =>
    presencas.data?.[jogoId] !== undefined || avaliacaoDoJogo(jogoId) !== undefined;

  const historico = jogos
    .filter((jogo) => estadoDoJogo(jogo, agora) === 'terminado' && foste(jogo.id))
    .sort((a, b) => b.inicio.localeCompare(a.inicio));

  return { foste, historico, aCarregar: userId !== null && presencas.isPending };
}
