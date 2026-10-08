// The weather at kick-off, from free sources: IPMA (official Portuguese forecasts, no key) for venues in Portugal and
// MET Norway (free, commercial use allowed with attribution) abroad. Pure functions shared by the `sync-weather` Edge
// Function and the app's tests. No imports, so both Deno and Node can load it.
//
// Both sources give times in UTC. Temperatures are whole °C, wind whole km/h, rain probability a whole percentage
// (`null` when the source has none: MET Norway only gives it in the Nordic countries).

export type WeatherCondition = 'sunny' | 'clear' | 'cloudy' | 'showers' | 'rain';
export type WarningLevel = 'yellow' | 'orange' | 'red';
export type WeatherSource = 'ipma' | 'met_norway';

export type KickoffWeather = {
  source: WeatherSource;
  /** The forecast slot used, ISO in UTC. */
  forecastFor: string;
  condition: WeatherCondition;
  temperatureC: number;
  rainProbability: number | null;
  windKmh: number;
};

export type Warning = { level: WarningLevel; kind: string };

/** Probability (%) from which we call it rain. Same threshold as the app's `LIMIAR_PROBABILIDADE_CHUVA`. */
export const RAIN_PROBABILITY_THRESHOLD = 40;

const HOUR_MS = 60 * 60 * 1000;

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

/** IPMA sends numbers as strings ("17.2") and -99 for "unknown". */
function ipmaNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > -90 ? parsed : null;
}

/** IPMA writes UTC times without a zone ("2026-10-08T19:00:00"). */
function ipmaTime(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const time = Date.parse(`${value}Z`);
  return Number.isFinite(time) ? time : null;
}

// --- Day or night -------------------------------------------------------------------------------------------------

/**
 * Whether the sun is up at that place and moment (NOAA's approximate solar position, good to a few minutes). Only
 * used to call a clear sky "sol" by day and "céu limpo" at night.
 */
export function isDaylight(latitude: number, longitude: number, at: Date): boolean {
  const dayOfYear =
    (Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()) - Date.UTC(at.getUTCFullYear(), 0, 0)) /
    (24 * HOUR_MS);
  const hours = at.getUTCHours() + at.getUTCMinutes() / 60;
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hours - 12) / 24);
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const solarMinutes = hours * 60 + equationOfTime + 4 * longitude;
  const hourAngle = ((solarMinutes / 4 - 180) * Math.PI) / 180;
  const lat = (latitude * Math.PI) / 180;
  const cosZenith =
    Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  // Sun above the horizon, counting refraction (zenith 90.833°).
  return cosZenith > Math.cos((90.833 * Math.PI) / 180);
}

// --- IPMA ---------------------------------------------------------------------------------------------------------

export type IpmaLocation = { id: number; name: string; latitude: number; longitude: number; warningArea: string };

/** Rows of https://api.ipma.pt/public-data/forecast/locations.json that have everything we need. */
export function parseIpmaLocations(payload: unknown): IpmaLocation[] {
  if (!Array.isArray(payload)) return [];
  const locations: IpmaLocation[] = [];
  for (const item of payload) {
    const row = asRecord(item);
    const id = typeof row?.globalIdLocal === 'number' ? row.globalIdLocal : null;
    const latitude = ipmaNumber(row?.latitude);
    const longitude = ipmaNumber(row?.longitude);
    if (id === null || latitude === null || longitude === null || typeof row?.idAreaAviso !== 'string') continue;
    locations.push({
      id,
      name: typeof row.local === 'string' ? row.local : String(id),
      latitude,
      longitude,
      warningArea: row.idAreaAviso,
    });
  }
  return locations;
}

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The IPMA forecast point nearest a venue, or `null` when none is within `maxKm` (the venue is not in Portugal). */
export function nearestIpmaLocation(
  locations: readonly IpmaLocation[],
  latitude: number,
  longitude: number,
  maxKm = 40
): IpmaLocation | null {
  let best: IpmaLocation | null = null;
  let bestKm = maxKm;
  for (const location of locations) {
    const km = distanceKm(latitude, longitude, location.latitude, location.longitude);
    if (km <= bestKm) {
      best = location;
      bestKm = km;
    }
  }
  return best;
}

/** IPMA weather type (https://api.ipma.pt/open-data/weather-type-classe.json) -> our condition; `null` if unknown. */
export function ipmaCondition(weatherType: number, daylight: boolean): WeatherCondition | null {
  // 1 clear, 2 mostly clear, 22 frost (a clear, cold sky).
  if ([1, 2, 22].includes(weatherType)) return daylight ? 'sunny' : 'clear';
  // Clouds, mist and fog.
  if ([3, 4, 5, 16, 17, 24, 25, 26, 27].includes(weatherType)) return 'cloudy';
  // Showers, light or heavy, with or without thunder; snow showers.
  if ([6, 7, 8, 20, 28].includes(weatherType)) return 'showers';
  // Rain, drizzle, snow, thunderstorms, hail.
  if ([9, 10, 11, 12, 13, 14, 15, 18, 19, 21, 23, 29, 30].includes(weatherType)) return 'rain';
  return null;
}

/** How far the rain probability may come from: IPMA gives it every 3 hours, for the 3 hours that follow. */
const IPMA_PROBABILITY_REACH_MS = 3 * HOUR_MS;

/** The rain probability of the hourly or 3-hourly slot nearest `time` that has one (most hourly slots say -99). */
function nearestIpmaProbability(payload: readonly unknown[], time: number): number | null {
  let best: { distance: number; probability: number } | null = null;
  for (const item of payload) {
    const row = asRecord(item);
    if (!row || (row.idPeriodo !== 1 && row.idPeriodo !== 3)) continue;
    const slot = ipmaTime(row.dataPrev);
    const probability = ipmaNumber(row.probabilidadePrecipita);
    if (slot === null || probability === null) continue;
    const distance = Math.abs(slot - time);
    if (distance > IPMA_PROBABILITY_REACH_MS) continue;
    // On a tie, the slot before: its value covers the hours after it.
    if (!best || distance < best.distance || (distance === best.distance && slot < time)) best = { distance, probability };
  }
  return best?.probability ?? null;
}

/** How far a forecast slot may be from kick-off: hourly slots first, then the 3-hourly ones of the later days. */
const IPMA_TOLERANCE_MS: Readonly<Record<number, number>> = { 1: 1 * HOUR_MS, 3: 2 * HOUR_MS };

/**
 * The weather at kick-off from an IPMA aggregate forecast (https://api.ipma.pt/public-data/forecast/aggregate/<id>.json):
 * the hourly slot nearest kick-off, or the 3-hourly one when the game is beyond the hourly range (about 3 days). The
 * daily summaries are not used: they have no temperature for a given hour. `null` when no slot is close enough.
 */
export function ipmaKickoffWeather(
  payload: unknown,
  kickoffAt: string,
  latitude: number,
  longitude: number
): KickoffWeather | null {
  if (!Array.isArray(payload)) return null;
  const kickoff = Date.parse(kickoffAt);
  if (!Number.isFinite(kickoff)) return null;

  for (const period of [1, 3]) {
    let best: { time: number; row: Readonly<Record<string, unknown>> } | null = null;
    for (const item of payload) {
      const row = asRecord(item);
      if (!row || row.idPeriodo !== period) continue;
      const time = ipmaTime(row.dataPrev);
      if (time === null || Math.abs(time - kickoff) > IPMA_TOLERANCE_MS[period]) continue;
      if (!best || Math.abs(time - kickoff) < Math.abs(best.time - kickoff)) best = { time, row };
    }
    if (!best) continue;

    const temperature = ipmaNumber(best.row.tMed);
    const wind = ipmaNumber(best.row.ffVento);
    const weatherType = ipmaNumber(best.row.idTipoTempo);
    const condition =
      weatherType === null ? null : ipmaCondition(weatherType, isDaylight(latitude, longitude, new Date(kickoff)));
    if (temperature === null || wind === null || condition === null) continue;
    const probability = ipmaNumber(best.row.probabilidadePrecipita) ?? nearestIpmaProbability(payload, best.time);
    return {
      source: 'ipma',
      forecastFor: new Date(best.time).toISOString(),
      condition,
      temperatureC: Math.round(temperature),
      rainProbability: probability === null ? null : Math.min(100, Math.max(0, Math.round(probability))),
      windKmh: Math.max(0, Math.round(wind)),
    };
  }
  return null;
}

const WARNING_RANK: Readonly<Record<WarningLevel, number>> = { yellow: 1, orange: 2, red: 3 };

/** Warnings about the sea: they do not change anything in a stadium. */
const IGNORED_WARNINGS = new Set(['agitação marítima']);

/** How much a warning may start after or end before kick-off and still count: the time around the game. */
const WARNING_MARGIN_MS = 3 * HOUR_MS;

/**
 * The strongest IPMA warning (https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json) for a warning area
 * around kick-off, or `null`. Green means "no warning" and is skipped, and so is the sea.
 */
export function ipmaWarning(payload: unknown, warningArea: string, kickoffAt: string): Warning | null {
  if (!Array.isArray(payload)) return null;
  const kickoff = Date.parse(kickoffAt);
  if (!Number.isFinite(kickoff)) return null;
  let best: Warning | null = null;
  for (const item of payload) {
    const row = asRecord(item);
    if (!row || row.idAreaAviso !== warningArea) continue;
    const level = row.awarenessLevelID;
    if (level !== 'yellow' && level !== 'orange' && level !== 'red') continue;
    const kind = typeof row.awarenessTypeName === 'string' ? row.awarenessTypeName.trim() : '';
    if (!kind || IGNORED_WARNINGS.has(kind.toLowerCase())) continue;
    const start = ipmaTime(row.startTime);
    const end = ipmaTime(row.endTime);
    if (start === null || end === null) continue;
    if (start > kickoff + WARNING_MARGIN_MS || end < kickoff - WARNING_MARGIN_MS) continue;
    if (!best || WARNING_RANK[level] > WARNING_RANK[best.level]) best = { level, kind: kind.slice(0, 60) };
  }
  return best;
}

// --- MET Norway ---------------------------------------------------------------------------------------------------

/** MET Norway symbol (https://api.met.no/weatherapi/weathericon/2.0/documentation) -> our condition. */
export function metCondition(symbolCode: string): WeatherCondition | null {
  const [name, variant] = symbolCode.split('_');
  if (!name) return null;
  if (name === 'clearsky' || name === 'fair') return variant === 'night' ? 'clear' : 'sunny';
  if (name === 'partlycloudy' || name === 'cloudy' || name === 'fog') return 'cloudy';
  if (name.includes('showers')) return 'showers';
  if (/rain|sleet|snow|thunder/.test(name)) return 'rain';
  return null;
}

/** How far a MET Norway slot may be from kick-off (hourly for about 2.5 days, then every 6 hours). */
const MET_TOLERANCE_MS = 3 * HOUR_MS;

/**
 * The weather at kick-off from a MET Norway `locationforecast/2.0/compact` answer: the slot nearest kick-off, with the
 * symbol of its next hour (or next 6 hours further ahead). No rain probability outside the Nordic countries.
 */
export function metKickoffWeather(payload: unknown, kickoffAt: string): KickoffWeather | null {
  const series = asRecord(asRecord(payload)?.properties)?.timeseries;
  const kickoff = Date.parse(kickoffAt);
  if (!Array.isArray(series) || !Number.isFinite(kickoff)) return null;

  let best: { time: number; data: Readonly<Record<string, unknown>> } | null = null;
  for (const item of series) {
    const row = asRecord(item);
    const time = typeof row?.time === 'string' ? Date.parse(row.time) : NaN;
    const data = asRecord(row?.data);
    if (!data || !Number.isFinite(time) || Math.abs(time - kickoff) > MET_TOLERANCE_MS) continue;
    if (!best || Math.abs(time - kickoff) < Math.abs(best.time - kickoff)) best = { time, data };
  }
  if (!best) return null;

  const details = asRecord(asRecord(best.data.instant)?.details);
  const next = asRecord(best.data.next_1_hours) ?? asRecord(best.data.next_6_hours);
  const symbol = asRecord(next?.summary)?.symbol_code;
  const temperature = details?.air_temperature;
  const windMs = details?.wind_speed;
  const condition = typeof symbol === 'string' ? metCondition(symbol) : null;
  if (typeof temperature !== 'number' || typeof windMs !== 'number' || condition === null) return null;
  const probability = asRecord(next?.details)?.probability_of_precipitation;
  return {
    source: 'met_norway',
    forecastFor: new Date(best.time).toISOString(),
    condition,
    temperatureC: Math.round(temperature),
    rainProbability:
      typeof probability === 'number' ? Math.min(100, Math.max(0, Math.round(probability))) : null,
    windKmh: Math.max(0, Math.round(windMs * 3.6)),
  };
}

// --- The notice before the game -----------------------------------------------------------------------------------

/** `null` when nobody knows yet. */
export type RoofCoverage = 'total' | 'parcial' | 'nenhuma' | null;

export function isRainy(weather: Pick<KickoffWeather, 'condition' | 'rainProbability'>) {
  return (
    weather.condition === 'rain' ||
    weather.condition === 'showers' ||
    (weather.rainProbability ?? 0) >= RAIN_PROBABILITY_THRESHOLD
  );
}

const LEVEL_NAME: Readonly<Record<WarningLevel, string>> = { yellow: 'amarelo', orange: 'laranja', red: 'vermelho' };

const lisbonTime = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' });

/**
 * The push sent to who is going, about 3 hours before kick-off, or `null` when there is nothing worth a notification:
 * an orange or red IPMA warning (whatever the roof), or rain at a stadium that is not fully covered.
 */
export function weatherNotice(input: {
  weather: Pick<KickoffWeather, 'condition' | 'rainProbability'>;
  warning: Warning | null;
  roof: RoofCoverage;
  venueName: string;
  kickoffAt: string;
}): { title: string; body: string } | null {
  const hour = lisbonTime.format(new Date(input.kickoffAt));
  const { warning } = input;
  if (warning && warning.level !== 'yellow') {
    return {
      title: `Aviso ${LEVEL_NAME[warning.level]}: ${warning.kind.toLowerCase()}`,
      body: `O IPMA tem aviso ${LEVEL_NAME[warning.level]} de ${warning.kind.toLowerCase()} para a zona do ${input.venueName} à hora do jogo (${hour}). Vai com tempo e atento às indicações.`,
    };
  }
  if (!isRainy(input.weather) || input.roof === 'total') return null;
  const chance =
    input.weather.rainProbability !== null && input.weather.rainProbability > 0
      ? `Há ${input.weather.rainProbability}% de probabilidade de chuva`
      : 'Está prevista chuva';
  const roof =
    input.roof === 'parcial'
      ? 'e a bancada só é coberta em parte.'
      : input.roof === 'nenhuma'
        ? 'e o estádio não tem cobertura.'
        : 'e não sabemos se a bancada é coberta.';
  return {
    title: 'Leva o impermeável',
    body: `${chance} no ${input.venueName} às ${hour} ${roof}`,
  };
}
