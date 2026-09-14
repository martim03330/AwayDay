import { temCheckInPerto } from '@/lib/presenca';
import { faseDoDiaDeJogo, mostrarRelogio } from '@/lib/relogio';
import type { Jogo, Local, MedicaoAdepto, MedicaoBarulho, VisitaLocal } from '@/mocks/tipos';
import type { IconName } from '@/ui/icon';

/*
 * Barulhómetro: ouve a bancada durante 10 segundos e dá um nível de 0 a 100.
 * O microfone do telemóvel não dá decibéis calibrados, por isso a escala é relativa.
 * As regras contra batota são heurísticas, a afinar com medições reais em estádio.
 */

export const DURACAO_MEDICAO_MS = 10_000;
export const INTERVALO_ENTRE_MEDICOES_MS = 5 * 60_000;
/** Tamanho de cada bloco analisado. */
export const DURACAO_BLOCO_MS = 100;
/** Amostras PCM (entre -1 e 1) a partir daqui contam como saturadas: o micro chegou ao limite. */
export const LIMIAR_SATURACAO = 0.98;
/** Mais do que esta fração de amostras saturadas: telemóvel colado à boca ou dedo no micro. */
export const MAX_FRACAO_SATURADA = 0.01;
/** Diferença (dB) entre os blocos mais barulhentos e os mais calmos a partir da qual só há picos soltos. */
export const MAX_AMPLITUDE_DB = 30;
/** Salto (dB) entre blocos seguidos que conta como grande: voz perto do micro, sopro, pancada. */
export const SALTO_GRANDE_DB = 10;
/** Mais saltos grandes do que isto por segundo: som aos solavancos, não barulho de bancada. */
export const MAX_SALTOS_GRANDES_POR_SEGUNDO = 0.8;
/** Parte mínima dos 10 segundos que tem de chegar; menos do que isso foi interrompida. */
export const MIN_COBERTURA = 0.8;

/** dBFS que correspondem ao 0 e ao 100 da escala. */
const DBFS_MINIMO = -60;
const DBFS_MAXIMO = -6;
/** Nível dado ao silêncio absoluto, para não calcular o logaritmo de zero. */
const DBFS_SILENCIO = -100;

export type BlocoSom = {
  /** Nível RMS do bloco em dBFS (0 é o máximo que o micro capta). */
  nivelDb: number;
  saturadas: number;
  amostras: number;
  duracaoMs: number;
};

function blocoDeAmostras(amostras: Float32Array, amostrasPorSegundo: number): BlocoSom {
  let somaDosQuadrados = 0;
  let saturadas = 0;
  for (const amostra of amostras) {
    somaDosQuadrados += amostra * amostra;
    if (Math.abs(amostra) >= LIMIAR_SATURACAO) saturadas++;
  }
  const rms = Math.sqrt(somaDosQuadrados / amostras.length);
  return {
    nivelDb: rms > 0 ? Math.max(DBFS_SILENCIO, 20 * Math.log10(rms)) : DBFS_SILENCIO,
    saturadas,
    amostras: amostras.length,
    duracaoMs: (amostras.length / amostrasPorSegundo) * 1000,
  };
}

/**
 * Junta um buffer PCM float32 ao que sobrou do anterior e parte tudo em blocos seguidos de 100 ms.
 * `amostrasPorSegundo` já conta com os canais. O que não chega a um bloco fica para o buffer seguinte.
 */
export function acumularBlocos(
  resto: ArrayLike<number>,
  novo: ArrayLike<number>,
  amostrasPorSegundo: number
) {
  const tamanho = Math.max(1, Math.round((amostrasPorSegundo * DURACAO_BLOCO_MS) / 1000));
  const dados = new Float32Array(resto.length + novo.length);
  dados.set(resto);
  dados.set(novo, resto.length);

  const blocos: BlocoSom[] = [];
  let inicio = 0;
  for (; inicio + tamanho <= dados.length; inicio += tamanho) {
    blocos.push(blocoDeAmostras(dados.subarray(inicio, inicio + tamanho), amostrasPorSegundo));
  }
  return { blocos, resto: dados.slice(inicio) };
}

export type MotivoMedicaoInvalida = 'curta' | 'saturada' | 'picos';

export type ResultadoMedicao =
  | { valida: true; nivel: number }
  | { valida: false; motivo: MotivoMedicaoInvalida };

function percentil(ordenados: readonly number[], fracao: number) {
  const indice = Math.round(fracao * (ordenados.length - 1));
  return ordenados[Math.min(ordenados.length - 1, Math.max(0, indice))] ?? DBFS_SILENCIO;
}

/** dBFS na escala de 0 a 100. */
export function nivelNaEscala(nivelDb: number) {
  const fracao = (nivelDb - DBFS_MINIMO) / (DBFS_MAXIMO - DBFS_MINIMO);
  return Math.round(Math.min(1, Math.max(0, fracao)) * 100);
}

export function analisarMedicao(blocos: readonly BlocoSom[]): ResultadoMedicao {
  const duracaoMs = blocos.reduce((soma, bloco) => soma + bloco.duracaoMs, 0);
  if (duracaoMs < DURACAO_MEDICAO_MS * MIN_COBERTURA || blocos.length < 2) {
    return { valida: false, motivo: 'curta' };
  }

  const amostras = blocos.reduce((soma, bloco) => soma + bloco.amostras, 0);
  const saturadas = blocos.reduce((soma, bloco) => soma + bloco.saturadas, 0);
  if (saturadas / amostras > MAX_FRACAO_SATURADA) return { valida: false, motivo: 'saturada' };

  const niveis = blocos.map((bloco) => bloco.nivelDb);
  const ordenados = [...niveis].sort((a, b) => a - b);
  const saltosGrandes = niveis
    .slice(1)
    .filter((nivel, indice) => Math.abs(nivel - (niveis[indice] ?? nivel)) >= SALTO_GRANDE_DB).length;
  const amplitude = percentil(ordenados, 0.9) - percentil(ordenados, 0.1);
  if (
    amplitude > MAX_AMPLITUDE_DB ||
    saltosGrandes / (duracaoMs / 1000) > MAX_SALTOS_GRANDES_POR_SEGUNDO
  ) {
    return { valida: false, motivo: 'picos' };
  }

  // Conta o nível que se aguenta (a mediana), não o pico: um grito isolado não sobe o resultado.
  return { valida: true, nivel: nivelNaEscala(percentil(ordenados, 0.5)) };
}

export type DegrauBarulho = { minimo: number; nome: string; icone: IconName; frase: string };

/** Nomes genéricos: servem para qualquer estádio e qualquer clube. */
const BIBLIOTECA: DegrauBarulho = {
  minimo: 0,
  nome: 'Biblioteca',
  icone: 'silencio',
  frase: 'Ouve-se o treinador a dar indicações.',
};

export const ESCALA_BARULHO: readonly DegrauBarulho[] = [
  BIBLIOTECA,
  {
    minimo: 20,
    nome: 'Conversa de café',
    icone: 'cafe',
    frase: 'Dá para comentar o jogo sem levantar a voz.',
  },
  {
    minimo: 40,
    nome: 'Bancada acordada',
    icone: 'megafone',
    frase: 'Já há cânticos, mas ainda há quem esteja a ver o telemóvel.',
  },
  { minimo: 60, nome: 'Caldeirão', icone: 'quente', frase: 'Para falar com o do lado, só por gestos.' },
  { minimo: 80, nome: 'Estádio a ferver', icone: 'explosao', frase: 'Amanhã ninguém tem voz.' },
];

export function degrauDoNivel(nivel: number) {
  return [...ESCALA_BARULHO].reverse().find((degrau) => nivel >= degrau.minimo) ?? BIBLIOTECA;
}

export const mensagensMedicaoInvalida: Record<
  MotivoMedicaoInvalida,
  { titulo: string; mensagem: string }
> = {
  saturada: {
    titulo: 'Telemóvel demasiado perto',
    mensagem:
      'O micro saturou, o que costuma querer dizer telemóvel colado à boca. Afasta-o da cara: isto não é karaoke.',
  },
  picos: {
    titulo: 'Só apanhámos picos soltos',
    mensagem:
      'Um grito ou um sopro não contam. O barulho de bancada é contínuo: tenta durante um cântico, com o telemóvel à altura do peito.',
  },
  curta: {
    titulo: 'A medição foi interrompida',
    mensagem: 'Chegaram menos de 8 segundos de som. Tenta outra vez.',
  },
};

export type EstadoBarulhometro =
  | { tipo: 'antes' }
  | { tipo: 'depois' }
  | { tipo: 'sem-check-in' }
  | { tipo: 'espera'; disponivelEm: number }
  | { tipo: 'pode-medir' };

type DadosBarulhometro = {
  jogo: Pick<Jogo, 'id' | 'inicio' | 'estadioId'>;
  agora: number;
  visitas: readonly VisitaLocal[];
  obterLocal: (id: string) => Local | undefined;
  medicoes: readonly MedicaoBarulho[];
};

/** Só se mede com o jogo a decorrer, com check-in feito hoje perto do estádio e uma vez a cada 5 minutos. */
export function estadoDoBarulhometro({
  jogo,
  agora,
  visitas,
  obterLocal,
  medicoes,
}: DadosBarulhometro): EstadoBarulhometro {
  const fase = faseDoDiaDeJogo(jogo, agora);
  if (fase === 'depois') return { tipo: 'depois' };
  if (fase !== 'a-decorrer') return { tipo: 'antes' };
  if (!temCheckInPerto(jogo.estadioId, agora, visitas, obterLocal)) return { tipo: 'sem-check-in' };

  const ultima = Math.max(
    -Infinity,
    ...medicoes.filter((medicao) => medicao.jogoId === jogo.id).map((medicao) => Date.parse(medicao.medidaEm))
  );
  if (agora - ultima < INTERVALO_ENTRE_MEDICOES_MS) {
    return { tipo: 'espera', disponivelEm: ultima + INTERVALO_ENTRE_MEDICOES_MS };
  }
  return { tipo: 'pode-medir' };
}

/** No dia do jogo; depois do apito final, só se houver medições tuas para mostrar. */
export function mostrarBarulhometro(
  jogo: Pick<Jogo, 'id' | 'inicio'>,
  agora: number,
  medicoes: readonly MedicaoBarulho[]
) {
  if (!mostrarRelogio(jogo, agora)) return false;
  return (
    faseDoDiaDeJogo(jogo, agora) !== 'depois' || medicoes.some((medicao) => medicao.jogoId === jogo.id)
  );
}

export function melhorMedicao(jogoId: string, medicoes: readonly MedicaoBarulho[]) {
  const niveis = medicoes.filter((medicao) => medicao.jogoId === jogoId).map((medicao) => medicao.nivel);
  return niveis.length > 0 ? Math.max(...niveis) : null;
}

export type EntradaRankingBarulho = {
  id: string;
  nome: string;
  clubeId: string;
  nivel: number;
  eTu: boolean;
  posicao: number;
};

/** Os adeptos mais barulhentos do jogo; entras tu quando tens uma medição válida. */
export function rankingBarulho(
  jogo: Pick<Jogo, 'casaId' | 'foraId'>,
  adeptos: readonly MedicaoAdepto[],
  tu: { clubeId: string; nivel: number | null }
): EntradaRankingBarulho[] {
  const outros = adeptos.map((adepto) => ({
    id: adepto.id,
    nome: adepto.nome,
    clubeId: adepto.lado === 'casa' ? jogo.casaId : jogo.foraId,
    nivel: adepto.nivel,
    eTu: false,
  }));
  const eu = tu.nivel === null ? [] : [{ id: 'tu', nome: 'Tu', clubeId: tu.clubeId, nivel: tu.nivel, eTu: true }];
  return [...outros, ...eu]
    .sort((a, b) => b.nivel - a.nivel || Number(b.eTu) - Number(a.eTu))
    .map((entrada, indice) => ({ ...entrada, posicao: indice + 1 }));
}
