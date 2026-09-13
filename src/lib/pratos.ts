import type { Meteorologia, Prato } from '@/mocks/tipos';

/** A partir destas temperaturas (°C) à hora do jogo, o destaque do topo inclui um lembrete. */
export const LIMIAR_CALOR = 25;
export const LIMIAR_FRIO = 13;

export type PratoComContagem = { prato: Prato; recomendacoes: number };

function comContagem(pratos: readonly Prato[], recomendados: ReadonlySet<string>) {
  return pratos.map((prato) => ({
    prato,
    recomendacoes: prato.recomendacoes + (recomendados.has(prato.id) ? 1 : 0),
  }));
}

/** Os três destaques do menu. Um prato pode ganhar mais do que um. */
export function destaquesDoMenu(pratos: readonly Prato[], recomendados: ReadonlySet<string>) {
  const lista = comContagem(pratos, recomendados);
  if (lista.length === 0) return null;

  const maisRecomendado = [...lista].sort(
    (a, b) => b.recomendacoes - a.recomendacoes || a.prato.precoEuros - b.prato.precoEuros
  )[0];
  const maisBarato = [...lista].sort(
    (a, b) => a.prato.precoEuros - b.prato.precoEuros || b.recomendacoes - a.recomendacoes
  )[0];
  const maisRapido = [...lista].sort(
    (a, b) =>
      a.prato.minutosPreparacao - b.prato.minutosPreparacao ||
      a.prato.precoEuros - b.prato.precoEuros
  )[0];

  return { maisRecomendado, maisBarato, maisRapido };
}

export function contagemDoPrato(prato: Prato, recomendados: ReadonlySet<string>) {
  return prato.recomendacoes + (recomendados.has(prato.id) ? 1 : 0);
}

/** Lembrete para o destaque do topo, condicionado pela meteorologia do próximo jogo. */
export function lembretePelaMeteorologia(
  meteorologia: Meteorologia | undefined,
  pratos: readonly Prato[]
) {
  if (!meteorologia) return null;
  const { temperatura } = meteorologia;

  if (temperatura >= LIMIAR_CALOR) {
    return {
      tipo: 'calor' as const,
      texto: `Estão ${temperatura} °C à hora do jogo: pede também uma água. A garganta vai precisar.`,
    };
  }

  if (temperatura <= LIMIAR_FRIO) {
    const quente = pratos
      .filter((prato) => prato.temperatura === 'quente')
      .sort((a, b) => a.minutosPreparacao - b.minutosPreparacao)[0];
    return {
      tipo: 'frio' as const,
      texto: quente
        ? `Estão ${temperatura} °C à hora do jogo: aquece com ${quente.nome.toLowerCase()} antes de entrares.`
        : `Estão ${temperatura} °C à hora do jogo: pede algo quente antes de entrares.`,
    };
  }

  return null;
}
