import { notaMedia } from '@/lib/jogos';
import type { AvaliacaoVisita } from '@/mocks/tipos';

/** Nota do estádio: média das notas de todas as tuas visitas. `null` se ainda não o avaliaste. */
export function notaDoEstadio(avaliacoes: readonly AvaliacaoVisita[], estadioId: string) {
  const visitas = avaliacoes.filter((avaliacao) => avaliacao.estadioId === estadioId);
  if (visitas.length === 0) return null;

  const soma = visitas.reduce((total, avaliacao) => total + notaMedia(avaliacao), 0);
  return { media: soma / visitas.length, visitas: visitas.length };
}
