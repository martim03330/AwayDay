// Portuguese phrases built from catalogue facts. Pure (no Deno or network APIs) so it can be tested
// anywhere. Names always come from the database; this only adds articles, prepositions and formats.

export type Article = 'o' | 'a' | 'os' | 'as' | '';
export type Preposition = 'a' | 'em' | 'de';

const CONTRACTIONS: Record<Preposition, Record<Exclude<Article, ''>, string>> = {
  a: { o: 'ao', a: 'à', os: 'aos', as: 'às' },
  em: { o: 'no', a: 'na', os: 'nos', as: 'nas' },
  de: { o: 'do', a: 'da', os: 'dos', as: 'das' },
};

export function isArticle(value: unknown): value is Article {
  return value === 'o' || value === 'a' || value === 'os' || value === 'as' || value === '';
}

/** "o Marítimo", "a Luz", or just "Alvalade" when the name takes no article. */
export function withArticle(article: Article, name: string) {
  return article === '' ? name : `${article} ${name}`;
}

/** "aos Barreiros", "na Luz", "em Alvalade", "da Pedreira". */
export function withPreposition(preposition: Preposition, article: Article, name: string) {
  return article === '' ? `${preposition} ${name}` : `${CONTRACTIONS[preposition][article]} ${name}`;
}

export function capitalize(text: string) {
  return text.length === 0 ? text : text.charAt(0).toLocaleUpperCase('pt-PT') + text.slice(1);
}

const LISBON_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Lisbon',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const LISBON_WEEKDAY = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Lisbon', weekday: 'short' });
const LISBON_TIME = new Intl.DateTimeFormat('pt-PT', {
  timeZone: 'Europe/Lisbon',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const LISBON_HOUR = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Lisbon',
  hour: '2-digit',
  hourCycle: 'h23',
});

const WEEKDAYS: Readonly<Record<string, string>> = {
  Sun: 'no domingo',
  Mon: 'na segunda-feira',
  Tue: 'na terça-feira',
  Wed: 'na quarta-feira',
  Thu: 'na quinta-feira',
  Fri: 'na sexta-feira',
  Sat: 'no sábado',
};

/** Calendar day in Lisbon, as "2026-09-19". */
export function lisbonDay(date: Date) {
  return LISBON_DAY.format(date);
}

/** Hour of the day in Lisbon, 0 to 23. */
export function lisbonHour(date: Date) {
  return Number(LISBON_HOUR.format(date));
}

function followingDay(day: string) {
  const [year = 0, month = 1, dayOfMonth = 1] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, dayOfMonth + 1)).toISOString().slice(0, 10);
}

/** "hoje", "amanhã", "no sábado" or "na quarta-feira", counted in Lisbon. */
export function whenPhrase(kickoff: Date, now: Date) {
  const day = lisbonDay(kickoff);
  const today = lisbonDay(now);
  if (day === today) return 'hoje';
  if (day === followingDay(today)) return 'amanhã';
  return WEEKDAYS[LISBON_WEEKDAY.format(kickoff)] ?? `a ${day}`;
}

/** "20:30", in Lisbon. */
export function timePhrase(kickoff: Date) {
  return LISBON_TIME.format(kickoff);
}

const LISBON_DAY_OF_MONTH = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', day: 'numeric' });

/** "no sábado, dia 19". Never "amanhã": a saved message may be read on another day. */
export function dayPhrase(kickoff: Date) {
  const weekday = WEEKDAYS[LISBON_WEEKDAY.format(kickoff)] ?? `a ${lisbonDay(kickoff)}`;
  return `${weekday}, dia ${LISBON_DAY_OF_MONTH.format(kickoff)}`;
}

export function minutesPhrase(minutes: number) {
  return `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
}

export function kmPhrase(km: number) {
  return `${km} km`;
}

export function ordinalPhrase(position: number) {
  return `${position}.º`;
}
