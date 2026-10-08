/**
 * How to complete each kind of mission, in two or three short steps, and the one action that takes the person
 * straight there. Keyed by the mission's metric (the catalogue's `mission.metric`), so a new mission of a known kind
 * gets its guide for free. Steps name the buttons exactly as they appear in the app.
 */

export type AcaoDaMissao = 'abrir-camara' | 'ver-jogos' | 'ver-tascos';

export type GuiaDaMissao = { passos: readonly string[]; acao: { rotulo: string; tipo: AcaoDaMissao } };

const CARIMBAR = [
  'Em dia de jogo, abre o jogo em Jogos.',
  'Já perto do estádio, com a localização ligada, toca em «Carimbar o estádio».',
];
const CHECK_IN = [
  'Abre em Locais o tasco onde estás.',
  'Já lá dentro, com a localização ligada, toca em «Fazer check-in».',
];
const VER_JOGOS = { rotulo: 'Ver os jogos', tipo: 'ver-jogos' } as const;
const VER_TASCOS = { rotulo: 'Ver tascos perto', tipo: 'ver-tascos' } as const;

const GUIAS: Readonly<Record<string, GuiaDaMissao>> = {
  stadium: { passos: [...CARIMBAR, 'Cada estádio diferente conta uma vez.'], acao: VER_JOGOS },
  stadium_visit: { passos: [...CARIMBAR, 'Cada jogo carimbado conta uma vez.'], acao: VER_JOGOS },
  new_stadium: { passos: [...CARIMBAR, 'Só conta num estádio onde ainda não tens carimbo.'], acao: VER_JOGOS },
  away_game: {
    passos: ['Escolhe um jogo em que o teu clube joga fora.', ...CARIMBAR.slice(1)],
    acao: VER_JOGOS,
  },
  district: { passos: [...CARIMBAR, 'Conta cada distrito novo onde carimbas.'], acao: VER_JOGOS },
  tasco: { passos: [...CHECK_IN, 'Cada tasco diferente conta uma vez.'], acao: VER_TASCOS },
  tasco_checkin: { passos: CHECK_IN, acao: VER_TASCOS },
  new_tasco: { passos: [...CHECK_IN, 'Só conta num tasco onde nunca fizeste check-in.'], acao: VER_TASCOS },
  tasco_photo: {
    passos: [
      'Abre em Locais o tasco onde estás.',
      'Na ficha, toca em «Enviar uma foto»: a sala, a montra ou o prato.',
      'Conta quando a foto for aprovada. Fica na ficha do tasco para toda a gente.',
    ],
    acao: VER_TASCOS,
  },
  review: {
    passos: [
      'Abre o estádio que carimbaste ou um tasco onde fizeste check-in.',
      'Dá a nota e, se quiseres, escreve uma frase.',
    ],
    acao: VER_TASCOS,
  },
  specialty: {
    passos: [
      'Faz check-in num tasco.',
      'Na ficha, em pratos, toca em «Recomendo» na especialidade que provaste.',
    ],
    acao: VER_TASCOS,
  },
  proof_photo: {
    passos: [
      'Em dia de jogo, perto do estádio.',
      'Pede primeiro. Cada um com a sua camisola, lado a lado e sem contacto.',
      'A foto é tirada na hora e fica no teu álbum do jogo.',
    ],
    acao: { rotulo: 'Abrir a câmara', tipo: 'abrir-camara' },
  },
};

/** The guide for a mission, or `null` for a kind the app does not know yet (the description is shown alone). */
export function guiaDaMissao(metrica: string): GuiaDaMissao | null {
  return Object.prototype.hasOwnProperty.call(GUIAS, metrica) ? (GUIAS[metrica] ?? null) : null;
}
