import { compararCentimos } from '@/lib/money';
import type { Meteorologia, Prato } from '@/mocks/tipos';

/** A partir destas temperaturas (°C) à hora do jogo, o destaque do topo inclui um lembrete. */
export const LIMIAR_CALOR = 25;
export const LIMIAR_FRIO = 13;

export type PratoComContagem = { prato: Prato; recomendacoes: number };

const NENHUM: ReadonlySet<string> = new Set();

/**
 * How many recommendations to show: the dish's count, minus yours if that count already included it (`jaContados`,
 * from the server), plus yours if you recommend it now. It never counts you twice.
 */
function contagem(
  prato: Prato,
  recomendados: ReadonlySet<string>,
  jaContados: ReadonlySet<string>
) {
  return (
    prato.recomendacoes - (jaContados.has(prato.id) ? 1 : 0) + (recomendados.has(prato.id) ? 1 : 0)
  );
}

function comContagem(
  pratos: readonly Prato[],
  recomendados: ReadonlySet<string>,
  jaContados: ReadonlySet<string>
) {
  return pratos.map((prato) => ({
    prato,
    recomendacoes: contagem(prato, recomendados, jaContados),
  }));
}

/**
 * Os destaques do menu. Um prato pode ganhar mais do que um. "Mais barato" e "Mais rápido" só contam pratos
 * com preço ou tempo confirmados, e ficam `null` se nenhum tiver.
 */
export function destaquesDoMenu(
  pratos: readonly Prato[],
  recomendados: ReadonlySet<string>,
  jaContados: ReadonlySet<string> = NENHUM
) {
  const lista = comContagem(pratos, recomendados, jaContados);
  if (lista.length === 0) return null;

  const maisRecomendado = [...lista].sort((a, b) => b.recomendacoes - a.recomendacoes)[0];

  const comPreco = lista.flatMap((item) =>
    item.prato.precoCentimos === null ? [] : [{ ...item, preco: item.prato.precoCentimos }]
  );
  const maisBarato =
    [...comPreco].sort(
      (a, b) => compararCentimos(a.preco, b.preco) || b.recomendacoes - a.recomendacoes
    )[0] ?? null;

  const comTempo = lista.flatMap((item) =>
    item.prato.minutosPreparacao === null
      ? []
      : [{ ...item, minutos: item.prato.minutosPreparacao }]
  );
  const maisRapido =
    [...comTempo].sort((a, b) => a.minutos - b.minutos || b.recomendacoes - a.recomendacoes)[0] ??
    null;

  return { maisRecomendado, maisBarato, maisRapido };
}

export function contagemDoPrato(
  prato: Prato,
  recomendados: ReadonlySet<string>,
  jaContados: ReadonlySet<string> = NENHUM
) {
  return contagem(prato, recomendados, jaContados);
}

/** Lembrete para o destaque do topo, condicionado pela meteorologia do próximo jogo. */
export function lembretePelaMeteorologia(
  meteorologia: Meteorologia | null | undefined,
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
      .sort((a, b) => (a.minutosPreparacao ?? Infinity) - (b.minutosPreparacao ?? Infinity))[0];
    return {
      tipo: 'frio' as const,
      texto: quente
        ? `Estão ${temperatura} °C à hora do jogo: aquece com ${quente.nome.toLowerCase()} antes de entrares.`
        : `Estão ${temperatura} °C à hora do jogo: pede algo quente antes de entrares.`,
    };
  }

  return null;
}
