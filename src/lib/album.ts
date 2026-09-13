import { checkInsDoDia, temCheckInPerto } from '@/lib/presenca';
import { mostrarRelogio } from '@/lib/relogio';
import type { FotoMissao, Jogo, Local, VisitaLocal } from '@/mocks/tipos';

type DadosContexto = {
  agora: number;
  jogos: readonly Jogo[];
  visitas: readonly VisitaLocal[];
  obterLocal: (id: string) => Local | undefined;
};

export type ContextoFoto = Pick<FotoMissao, 'jogoId' | 'estadioId' | 'verificada'>;

/**
 * Onde e quando a foto foi tirada. Só fica verificada em dia de jogo, com check-in feito nesse dia
 * num tasco perto do estádio. Sem esse check-in não se inventa jogo nenhum.
 */
export function contextoDaFoto({ agora, jogos, visitas, obterLocal }: DadosContexto): ContextoFoto {
  const jogo = jogos.find(
    (candidato) =>
      mostrarRelogio(candidato, agora) &&
      temCheckInPerto(candidato.estadioId, agora, visitas, obterLocal)
  );
  if (jogo) return { jogoId: jogo.id, estadioId: jogo.estadioId, verificada: true };

  const ultimoCheckIn = checkInsDoDia(agora, visitas)[0];
  const estadioId = ultimoCheckIn ? (obterLocal(ultimoCheckIn.localId)?.estadioId ?? null) : null;
  return { jogoId: null, estadioId, verificada: false };
}

/** Mais recentes primeiro. */
export function ordenarFotos(fotos: readonly FotoMissao[]) {
  return [...fotos].sort((a, b) => Date.parse(b.tiradaEm) - Date.parse(a.tiradaEm));
}
