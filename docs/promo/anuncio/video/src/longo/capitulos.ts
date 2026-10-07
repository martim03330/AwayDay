import type { Regiao } from '../componentes';

/**
 * The full tour of the app, chapter by chapter. Lengths are in bars of the 120 BPM music (1 bar = 2 s = 60 frames);
 * they must match BARRAS_LONGO in musica.py. Frames inside a shot count from the shot's start.
 *
 * The whole phone is always on screen. Each shot shows one still screen, or one short tap (a page opening): the clip
 * plays from `inicio` for `toca` seconds and then holds. The still moments were found with ffmpeg's freezedetect,
 * so no shot shows a long scroll. Every `regiao` is measured on the 1320 × 2868 recording in the held state.
 */

export const BARRA = 60;

export type Toque = { f: number; x: number; y: number };

export type Plano = {
  clipe: string;
  /** Second of the clip where the shot starts. */
  inicio: number;
  /** Seconds it plays before holding (0 = held from the start). */
  toca: number;
  duracao: number;
  toques?: Toque[];
  recortes?: { regiao: Regiao; de: number; ate: number; legenda: string }[];
};

export type Capitulo = {
  barras: number;
  numero: string;
  titulo: string;
  frase: string;
  icone: 'bola' | 'carro' | 'tasco' | 'euro' | 'ranking';
  planos: Plano[];
};

export const INTRO_BARRAS = 2;
export const FECHO_BARRAS = 3;

const DADOS: Omit<Capitulo, 'numero'>[] = [
  {
    barras: 4,
    titulo: 'Escolhe o jogo',
    frase: 'Os jogos do teu clube, com a hora do apito e tudo o que precisas para esse dia.',
    icone: 'bola',
    planos: [
      { clipe: '01-jogos.mp4', inicio: 1.1, toca: 0, duracao: 120, toques: [{ f: 108, x: 660, y: 1600 }], recortes: [{ regiao: { x: 60, y: 1345, w: 1200, h: 520 }, de: 22, ate: 100, legenda: 'O teu próximo jogo' }] },
      { clipe: '02-jogo.mp4', inicio: 0, toca: 0, duracao: 120, recortes: [{ regiao: { x: 60, y: 2110, w: 1200, h: 240 }, de: 24, ate: 112, legenda: 'Boleias para este jogo' }] },
    ],
  },
  {
    barras: 4,
    titulo: 'Combina com a malta',
    frase: 'Cria um grupo, lança o jogo e cada um diz se vai. A boleia e a casa ficam no mesmo sítio.',
    icone: 'bola',
    planos: [
      { clipe: '03-malta.mp4', inicio: 0.3, toca: 1.5, duracao: 80, toques: [{ f: 18, x: 700, y: 1250 }] },
      { clipe: '03-malta.mp4', inicio: 4.2, toca: 0, duracao: 90, recortes: [{ regiao: { x: 60, y: 1480, w: 1200, h: 520 }, de: 10, ate: 84, legenda: 'Quem vai, num toque' }] },
      { clipe: '04-plano-dormir.mp4', inicio: 2.5, toca: 0.9, duracao: 70 },
    ],
  },
  {
    barras: 5,
    titulo: 'Boleia a meias',
    frase: 'Oferece lugar ou encontra quem vá do teu lado. O custo sai do combustível e das portagens, ao cêntimo.',
    icone: 'carro',
    planos: [
      { clipe: '05-boleias.mp4', inicio: 0.6, toca: 0, duracao: 140, toques: [{ f: 130, x: 660, y: 560 }], recortes: [{ regiao: { x: 60, y: 410, w: 1200, h: 410 }, de: 18, ate: 120, legenda: 'Preço por pessoa' }] },
      { clipe: '05-boleias.mp4', inicio: 2.3, toca: 0.8, duracao: 160, recortes: [{ regiao: { x: 50, y: 820, w: 1220, h: 250 }, de: 40, ate: 150, legenda: 'Combustível e portagens, a dividir' }] },
    ],
  },
  {
    barras: 2,
    titulo: 'A conversa do carro',
    frase: 'Quem vai no carro combina a hora e o sítio, sem se perder nas mensagens do grupo.',
    icone: 'carro',
    planos: [{ clipe: '06-conversa-carro.mp4', inicio: 0, toca: 1.0, duracao: 120, recortes: [{ regiao: { x: 60, y: 1390, w: 1220, h: 1200 }, de: 38, ate: 112, legenda: 'Só quem vai no carro' }] }],
  },
  {
    barras: 3,
    titulo: 'Chega a horas',
    frase: 'Onde deixar o carro e a que horas chegar para ainda apanhares lugar.',
    icone: 'carro',
    planos: [{ clipe: '07-estacionar.mp4', inicio: 0.5, toca: 0, duracao: 180, recortes: [{ regiao: { x: 60, y: 910, w: 1200, h: 650 }, de: 26, ate: 166, legenda: 'O parque certo, à hora certa' }] }],
  },
  {
    barras: 3,
    titulo: 'O estádio',
    frase: 'A ficha do estádio, os cuidados a ter nesse jogo e a casa de banho mais perto.',
    icone: 'bola',
    planos: [
      {
        clipe: '08-estadio.mp4',
        inicio: 9.45,
        toca: 0,
        duracao: 180,
        recortes: [
          { regiao: { x: 60, y: 330, w: 1200, h: 310 }, de: 16, ate: 84, legenda: 'Cuidados a ter' },
          { regiao: { x: 60, y: 920, w: 1200, h: 560 }, de: 96, ate: 172, legenda: 'O WC mais perto' },
        ],
      },
    ],
  },
  {
    barras: 5,
    titulo: 'Os tascos à volta',
    frase: 'Tascos a menos de 20 minutos a pé, avaliados por quem lá foi. Vês quem lá está agora e o que pedir.',
    icone: 'tasco',
    planos: [
      { clipe: '09-mapa.mp4', inicio: 0.3, toca: 1.1, duracao: 110, toques: [{ f: 8, x: 660, y: 2350 }] },
      { clipe: '10-tasco.mp4', inicio: 0.2, toca: 0, duracao: 95, recortes: [{ regiao: { x: 50, y: 770, w: 1220, h: 270 }, de: 12, ate: 88, legenda: 'Quem lá está agora' }] },
      { clipe: '10-tasco.mp4', inicio: 6.3, toca: 0, duracao: 95, recortes: [{ regiao: { x: 40, y: 1760, w: 960, h: 620 }, de: 10, ate: 88, legenda: 'O que pedir' }] },
    ],
  },
  {
    barras: 3,
    titulo: 'As contas da viagem',
    frase: 'Cada um junta o que pagou: a boleia, os bilhetes, a cerveja. A app diz quem deve a quem.',
    icone: 'euro',
    planos: [
      {
        // The tap on «Acertar contas» is at 3.03 s of the clip: hold after it, on who owes whom.
        clipe: '11-contas.mp4',
        inicio: 2.6,
        toca: 0.85,
        duracao: 180,
        toques: [{ f: 9, x: 970, y: 345 }],
        recortes: [
          { regiao: { x: 40, y: 810, w: 1240, h: 600 }, de: 40, ate: 112, legenda: 'Quem deve a quem' },
          { regiao: { x: 40, y: 1625, w: 1240, h: 200 }, de: 120, ate: 174, legenda: 'Pagou? Confirma tu' },
        ],
      },
    ],
  },
  {
    barras: 3,
    titulo: 'Dorme fora com a malta',
    frase: 'Jogo longe? Alguém propõe a casa com o preço total, e o grupo junta-se até dar para reservar.',
    icone: 'bola',
    planos: [
      { clipe: '04-plano-dormir.mp4', inicio: 2.6, toca: 0.8, duracao: 90, recortes: [{ regiao: { x: 60, y: 410, w: 1210, h: 520 }, de: 30, ate: 84, legenda: 'Quem vai a Lens' }] },
      { clipe: '04-plano-dormir.mp4', inicio: 6.7, toca: 0, duracao: 90, recortes: [{ regiao: { x: 60, y: 1420, w: 1200, h: 620 }, de: 10, ate: 84, legenda: 'Mais barato a cada pessoa' }] },
    ],
  },
  {
    barras: 3,
    titulo: 'O passaporte de estádios',
    frase: 'Carimba cada estádio onde vais, só lá dentro e só no dia do jogo.',
    icone: 'bola',
    planos: [
      { clipe: '12-passaporte.mp4', inicio: 1.2, toca: 1.0, duracao: 180, toques: [{ f: 6, x: 660, y: 2346 }], recortes: [{ regiao: { x: 60, y: 1055, w: 1200, h: 820 }, de: 44, ate: 170, legenda: 'Só conta se estiveres lá' }] },
    ],
  },
  {
    barras: 4,
    titulo: 'Ranking e missões',
    frase: 'Pontos pelo que a app confirma, desafios todas as semanas e a tua divisão.',
    icone: 'ranking',
    planos: [
      { clipe: '13-ranking.mp4', inicio: 0.3, toca: 0, duracao: 120, recortes: [{ regiao: { x: 60, y: 930, w: 1200, h: 700 }, de: 16, ate: 110, legenda: 'Sobe no ranking' }] },
      { clipe: '14-missoes.mp4', inicio: 0.3, toca: 0, duracao: 120, recortes: [{ regiao: { x: 60, y: 540, w: 1220, h: 600 }, de: 14, ate: 112, legenda: 'Desafios da semana' }] },
    ],
  },
];

export const CAPITULOS: Capitulo[] = DADOS.map((c, i) => ({ ...c, numero: String(i + 1).padStart(2, '0') }));

/** Start frame of each chapter, then the end card. */
export const INICIOS = (() => {
  const out: number[] = [];
  let t = INTRO_BARRAS * BARRA;
  for (const c of CAPITULOS) {
    out.push(t);
    t += c.barras * BARRA;
  }
  out.push(t);
  return out;
})();

export const INICIO_FECHO = INICIOS[INICIOS.length - 1];
export const DURACAO_LONGO = INICIO_FECHO + FECHO_BARRAS * BARRA + 30;
