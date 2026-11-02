import type { ClubVehicleKind } from '@/features/casas/types';
import { dataEmLisboaAPartirDe } from '@/lib/datas';

// The pure parts of the managers' forms: times typed in Lisbon, companions typed as a list, and what a new trip is
// still missing. The server checks all of it again; this only lets the form say it before sending.

/** The price limit the server accepts for a trip: 1000 € per person. */
export const PRECO_MAXIMO_DA_VIAGEM = 100_000;

export const NOMES_DOS_TRANSPORTES: Record<ClubVehicleKind, string> = {
  autocarro: 'Autocarro',
  minibus: 'Minibus',
  carrinha: 'Carrinha',
};

/** Seats a new vehicle of each kind starts with; the manager changes it. */
export const LUGARES_POR_OMISSAO: Record<ClubVehicleKind, number> = {
  autocarro: 50,
  minibus: 20,
  carrinha: 8,
};

/** «20:30», «9:05», «20h30», «7h» → «HH:MM»; `null` for anything that is not a time of day. */
export function lerHora(texto: string): string | null {
  const partes = /^(\d{1,2})(?:[:h](\d{2})?)?$/.exec(texto.trim().toLowerCase());
  if (!partes) return null;
  const horas = Number(partes[1]);
  const minutos = Number(partes[2] ?? '0');
  if (horas > 23 || minutos > 59) return null;
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

/** The instant (UTC ISO) of `hora` in Lisbon, `diasAntes` days before the game's day in Lisbon. */
export function instanteAntesDoJogo(kickoffAt: string, diasAntes: number, hora: string): string {
  return dataEmLisboaAPartirDe(new Date(kickoffAt), -diasAntes, hora).toISOString();
}

/** «Ana, Rui» → ['Ana', 'Rui']. */
export function lerAcompanhantes(texto: string): string[] {
  return texto
    .split(',')
    .map((nome) => nome.trim())
    .filter((nome) => nome.length > 0);
}

/** «Autocarro 2». */
export function nomeDoTransporte(kind: ClubVehicleKind, numero: number): string {
  return `${NOMES_DOS_TRANSPORTES[kind]} ${numero}`;
}

export type RascunhoDaViagem = {
  nome: string;
  /** `null` when what was typed is not a price. */
  precoCentimos: number | null;
  /** `null` when the deadline's time is not a time. */
  prazo: string | null;
  paragens: { passesAt: string }[];
  transportes: { label: string; seats: number }[];
  kickoffAt: string;
};

/** The first thing a new trip is missing, as a sentence, or `null` when it can be published. */
export function problemaDaViagem(rascunho: RascunhoDaViagem, agora: number): string | null {
  const jogo = Date.parse(rascunho.kickoffAt);
  const entreAgoraEOJogo = (instante: string) => {
    const quando = Date.parse(instante);
    return quando > agora && quando <= jogo;
  };

  if (rascunho.nome.trim().length < 3) return 'O nome da viagem precisa de pelo menos 3 letras.';
  if (rascunho.precoCentimos === null || rascunho.precoCentimos > PRECO_MAXIMO_DA_VIAGEM) {
    return 'Escreve o preço por pessoa (0 se for gratuita), até 1000 €.';
  }
  if (rascunho.prazo === null) return 'Escreve a hora do prazo das inscrições (ex.: 20:00).';
  if (!entreAgoraEOJogo(rascunho.prazo)) {
    return 'O prazo das inscrições tem de ser depois de agora e antes do jogo.';
  }
  if (rascunho.paragens.length === 0) return 'Acrescenta pelo menos uma paragem.';
  if (rascunho.paragens.some((paragem) => !entreAgoraEOJogo(paragem.passesAt))) {
    return 'Cada paragem tem de ser depois de agora e antes do jogo.';
  }
  if (rascunho.transportes.length === 0) return 'Acrescenta pelo menos um transporte.';
  if (rascunho.transportes.some((transporte) => transporte.label.trim().length === 0)) {
    return 'Dá um nome a cada transporte.';
  }
  return null;
}
