const OSM_WORDS: [RegExp, string][] = [
  [/\bMo\b/g, 'Seg'],
  [/\bTu\b/g, 'Ter'],
  [/\bWe\b/g, 'Qua'],
  [/\bTh\b/g, 'Qui'],
  [/\bFr\b/g, 'Sex'],
  [/\bSa\b/g, 'Sáb'],
  [/\bSu\b/g, 'Dom'],
  [/\bPH\b/g, 'feriados'],
  [/\boff\b/g, 'fechado'],
];

/** OpenStreetMap opening hours ("Mo-Fr 08:00-23:00; Su off") in Portuguese ("Seg-Sex 08:00-23:00; Dom fechado"). */
export function horarioEmPortugues(openingHours: string | null) {
  if (!openingHours) return null;
  if (openingHours.trim() === '24/7') return 'Sempre aberto';
  return OSM_WORDS.reduce(
    (texto, [padrao, palavra]) => texto.replace(padrao, palavra),
    openingHours
  );
}
