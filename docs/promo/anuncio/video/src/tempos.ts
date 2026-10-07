/**
 * The short ad's timeline, in frames at 30 fps (one beat of the 120 BPM music = 15 frames, so every cut lands on a
 * beat). The music (musica.py, mode `curto`) uses the same moments in seconds: change them in both places.
 */
export const FPS = 30;
export const DURACAO = 29 * FPS;

export const T = {
  caos: 0, // the pitch and «Jogo fora no sábado?»
  acabou: 75, // DROP: «A app de quem vai à bola.»
  boleia: 105, // the ride, to the cent (the only money scene)
  tasco: 210, // 0 → 27 people there now
  carimbos: 315, // stamps raining onto the passport
  ranking: 435, // climbing the table, levelling up
  missoes: 555, // the week's missions ticking off
  memoria: 675, // the trip's memory
  fecho: 765, // end card
} as const;
