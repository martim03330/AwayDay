import { filtrarPorTempoAPe, ordenarTascos, valeACaminhada } from '@/lib/locais';
import { estadiosNacionais } from '@/mocks/estadios';
import { locaisDoEstadio } from '@/mocks/locais';
import type { Venue } from '@/mocks/tipos';

/** Which stadium the Locais tab shows, and the tascos around it. Shared by the tab, its club sheet and the list. */

/**
 * The stadiums to choose from: the fan's own clubs' first (in their order), then those with tascos nearby, then the
 * rest, each group keeping its original order. Pure, for the tests.
 */
export function ordenarParaEscolha<E extends { id: string; clubeId: string }>(
  estadios: readonly E[],
  meusClubes: readonly string[],
  temLocais: (estadioId: string) => boolean
) {
  const meus = meusClubes.flatMap((clubeId) => estadios.filter((estadio) => estadio.clubeId === clubeId));
  const outros = estadios.filter((estadio) => !meus.includes(estadio));
  const comLocais = outros.filter((estadio) => temLocais(estadio.id));
  const semLocais = outros.filter((estadio) => !temLocais(estadio.id));
  return { meus, outros: [...comLocais, ...semLocais] };
}

export function temLocaisPerto(estadioId: string) {
  return filtrarPorTempoAPe(locaisDoEstadio(estadioId)).perto.length > 0;
}

/** Calculated at each render: the tascos arrive after the first one. */
export function estadiosParaEscolha(meusClubes: readonly string[]): { meus: Venue[]; outros: Venue[] } {
  return ordenarParaEscolha(estadiosNacionais, meusClubes, temLocaisPerto);
}

/** The tascos around a stadium, as the tab and its list show them. */
export function tascosDoEstadio(estadioId: string) {
  const todos = locaisDoEstadio(estadioId);
  const { perto: porDistancia, maisLonge } = filtrarPorTempoAPe(todos);
  const perto = ordenarTascos(porDistancia);
  return {
    perto,
    confirmados: perto.filter((local) => local.confirmacao === 'confirmado'),
    sugestoes: perto.filter((local) => local.confirmacao === 'sugerido'),
    // Further than the list normally goes, but worth it: confirmed by fans, or put there by one.
    valeAPena: valeACaminhada(todos),
    maisLonge,
  };
}
