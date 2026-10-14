/**
 * The rides ad's timeline, in frames at 30 fps (one beat of the 120 BPM music = 15 frames, a bar = 60). The music
 * (musica.py, mode `boleias`) uses the same moments in seconds: change them in both places.
 */
export const DURACAO_BOLEIAS = 32 * 30;

export const TB = {
  pergunta: 0, // a green dot becomes «Alguém vai ao jogo de sábado?»
  mapa: 120, // DROP: the map opens and the route draws itself to the stadium
  carro: 240, // «Boleia?» card, tap on «Pedir lugar»
  bolha: 330, // the green spreads from the button over the screen; the cards open out of it like an iris
  cartoes: 360, // floating cards: seats filling, meeting point, the split (the only money)
  caminho: 540, // the passengers walk to the car, it drives off, the stadium lights up
  frases: 720, // «Ninguém fica em casa.» → «Vamos juntos.»
  fecho: 840, // end card
} as const;
