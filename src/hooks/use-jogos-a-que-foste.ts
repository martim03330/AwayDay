import { useMyAttendance } from '@/features/activity/hooks/useAttendance';
import { useNow } from '@/hooks/use-now';
import { estadoDoJogo } from '@/lib/jogos';
import { useUserId } from '@/lib/session';
import { jogos } from '@/mocks/jogos';
import { useAppState } from '@/state/app-state';

/**
 * Fixtures the user went to: only with the stadium stamp, which the server checks against the phone's location
 * (`stamp_stadium` is the only thing that marks a game as attended). Saying «Vou», joining a plan or rating a game is
 * not going. In demo mode, the sample ratings stand in for it. `historico` holds the finished ones, newest first.
 */
export function useJogosAQueFoste() {
  const agora = useNow();
  const userId = useUserId();
  const presencas = useMyAttendance(userId);
  const { avaliacaoDoJogo, modoDemo } = useAppState();

  const foste = (jogoId: string) =>
    modoDemo ? avaliacaoDoJogo(jogoId) !== undefined : presencas.data?.[jogoId] === 'attended';

  const historico = jogos
    .filter((jogo) => estadoDoJogo(jogo, agora) === 'terminado' && foste(jogo.id))
    .sort((a, b) => b.inicio.localeCompare(a.inicio));

  return { foste, historico, aCarregar: userId !== null && presencas.isPending };
}
