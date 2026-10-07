/**
 * The short ad's timeline, in frames at 30 fps (one beat of the 120 BPM music = 15 frames, so every cut lands on a
 * beat). The music (musica.py, mode `curto`) uses the same moments in seconds: change them in both places.
 */
export const FPS = 30;
export const DURACAO = 25 * FPS;

export const T = {
  caos: 0, // the group chat piling up
  acabou: 75, // DROP: «Acabou a confusão.»
  boleia: 105, // 143,52 € ÷ 4 = 35,88 €
  tasco: 225, // 0 → 27 people there now
  contas: 345, // who owes whom
  carimbo: 465, // the stadium stamp
  memoria: 555, // the trip's memory
  fecho: 645, // end card
} as const;
