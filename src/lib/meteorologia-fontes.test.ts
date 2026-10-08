import { describe, expect, it } from 'vitest';

import {
  ipmaCondition,
  ipmaKickoffWeather,
  ipmaWarning,
  isDaylight,
  metCondition,
  metKickoffWeather,
  nearestIpmaLocation,
  parseIpmaLocations,
  weatherNotice,
} from '../../supabase/functions/_shared/weather';

// Shapes copied from the real answers of IPMA and MET Norway (2026-10-08), trimmed to the fields used.

const LISBOA = { latitude: 38.7527, longitude: -9.1847 };

function ipmaSlot(period: number, dataPrev: string, extra: Record<string, unknown> = {}) {
  return {
    idPeriodo: period,
    dataPrev,
    tMed: '17.6',
    ffVento: '13.7',
    idTipoTempo: 1,
    probabilidadePrecipita: '0.0',
    globalIdLocal: 1110600,
    ...extra,
  };
}

describe('isDaylight', () => {
  it('knows day from night in Lisbon, summer and winter', () => {
    expect(isDaylight(LISBOA.latitude, LISBOA.longitude, new Date('2026-10-08T14:00:00Z'))).toBe(true);
    expect(isDaylight(LISBOA.latitude, LISBOA.longitude, new Date('2026-10-08T20:30:00Z'))).toBe(false);
    // 18:30 UTC in late May is still day; in December it is night.
    expect(isDaylight(LISBOA.latitude, LISBOA.longitude, new Date('2026-05-30T18:30:00Z'))).toBe(true);
    expect(isDaylight(LISBOA.latitude, LISBOA.longitude, new Date('2026-12-20T18:30:00Z'))).toBe(false);
  });
});

describe('IPMA', () => {
  it('reads the forecast points and finds the one nearest a stadium', () => {
    const locations = parseIpmaLocations([
      { globalIdLocal: 1110600, local: 'Lisboa', latitude: '38.7660', longitude: '-9.1286', idAreaAviso: 'LSB' },
      { globalIdLocal: 1131200, local: 'Porto', latitude: '41.1580', longitude: '-8.6294', idAreaAviso: 'PTO' },
      { globalIdLocal: 'x', local: 'Broken', latitude: '0', longitude: '0', idAreaAviso: 'X' },
    ]);
    expect(locations.map((location) => location.name)).toEqual(['Lisboa', 'Porto']);
    expect(nearestIpmaLocation(locations, 41.1617, -8.5839)?.name).toBe('Porto');
    // Lens, in France: nothing within reach, so it falls to MET Norway.
    expect(nearestIpmaLocation(locations, 50.4328, 2.815)).toBeNull();
  });

  it('maps weather types, sun by day and clear sky at night', () => {
    expect(ipmaCondition(1, true)).toBe('sunny');
    expect(ipmaCondition(1, false)).toBe('clear');
    expect(ipmaCondition(4, true)).toBe('cloudy');
    expect(ipmaCondition(7, true)).toBe('showers');
    expect(ipmaCondition(9, true)).toBe('rain');
    expect(ipmaCondition(19, false)).toBe('rain');
    expect(ipmaCondition(0, true)).toBeNull();
    expect(ipmaCondition(-99, true)).toBeNull();
  });

  it('uses the hourly slot nearest kick-off, read as UTC', () => {
    const payload = [
      { idPeriodo: 24, dataPrev: '2026-10-08T00:00:00', tMin: '15.7', tMax: '28.8', idTipoTempo: 2 },
      ipmaSlot(1, '2026-10-08T18:00:00', { tMed: '23.0' }),
      ipmaSlot(1, '2026-10-08T19:00:00', { tMed: '21.9', idTipoTempo: 9, probabilidadePrecipita: '64.0', ffVento: '22.4' }),
      ipmaSlot(1, '2026-10-08T20:00:00', { tMed: '21.6' }),
    ];
    expect(ipmaKickoffWeather(payload, '2026-10-08T19:15:00Z', LISBOA.latitude, LISBOA.longitude)).toEqual({
      source: 'ipma',
      forecastFor: '2026-10-08T19:00:00.000Z',
      condition: 'rain',
      temperatureC: 22,
      rainProbability: 64,
      windKmh: 22,
    });
  });

  it('falls back to the 3-hourly slots for games further ahead, and never to the daily summary', () => {
    const payload = [
      ipmaSlot(3, '2026-10-12T18:00:00', { tMed: '19.4', idTipoTempo: 3 }),
      ipmaSlot(3, '2026-10-12T21:00:00', { tMed: '17.0' }),
      { idPeriodo: 24, dataPrev: '2026-10-13T00:00:00', tMin: '12', tMax: '20', idTipoTempo: 9 },
    ];
    const weather = ipmaKickoffWeather(payload, '2026-10-12T19:00:00Z', LISBOA.latitude, LISBOA.longitude);
    expect(weather?.forecastFor).toBe('2026-10-12T18:00:00.000Z');
    expect(weather?.condition).toBe('cloudy');
    expect(ipmaKickoffWeather(payload, '2026-10-13T19:00:00Z', LISBOA.latitude, LISBOA.longitude)).toBeNull();
  });

  it('takes the rain probability from the nearest slot that has one (IPMA gives it every 3 hours)', () => {
    const payload = [
      ipmaSlot(1, '2026-10-09T15:00:00', { probabilidadePrecipita: '70.0' }),
      ipmaSlot(1, '2026-10-09T18:00:00', { probabilidadePrecipita: '20.0' }),
      ipmaSlot(1, '2026-10-09T19:00:00', { probabilidadePrecipita: '-99.0' }),
      ipmaSlot(1, '2026-10-09T21:00:00', { probabilidadePrecipita: '0.0' }),
    ];
    expect(ipmaKickoffWeather(payload, '2026-10-09T19:15:00Z', LISBOA.latitude, LISBOA.longitude)?.rainProbability).toBe(20);
  });

  it('treats -99 as no rain probability, and skips slots too far from kick-off', () => {
    const payload = [ipmaSlot(1, '2026-10-08T02:00:00', { probabilidadePrecipita: '-99.0', idTipoTempo: 1 })];
    expect(ipmaKickoffWeather(payload, '2026-10-08T02:30:00Z', LISBOA.latitude, LISBOA.longitude)?.rainProbability).toBeNull();
    expect(ipmaKickoffWeather(payload, '2026-10-08T04:00:00Z', LISBOA.latitude, LISBOA.longitude)).toBeNull();
    expect(ipmaKickoffWeather('nope', '2026-10-08T02:00:00Z', 0, 0)).toBeNull();
  });

  it('picks the strongest warning for the area around kick-off, ignoring green and the sea', () => {
    const warnings = [
      { idAreaAviso: 'LSB', awarenessLevelID: 'green', awarenessTypeName: 'Vento', startTime: '2026-10-08T00:00:00', endTime: '2026-10-09T00:00:00' },
      { idAreaAviso: 'LSB', awarenessLevelID: 'red', awarenessTypeName: 'Agitação Marítima', startTime: '2026-10-08T00:00:00', endTime: '2026-10-09T00:00:00' },
      { idAreaAviso: 'LSB', awarenessLevelID: 'yellow', awarenessTypeName: 'Precipitação', startTime: '2026-10-08T15:00:00', endTime: '2026-10-08T21:00:00' },
      { idAreaAviso: 'LSB', awarenessLevelID: 'orange', awarenessTypeName: 'Vento', startTime: '2026-10-08T18:00:00', endTime: '2026-10-08T23:00:00' },
      { idAreaAviso: 'PTO', awarenessLevelID: 'red', awarenessTypeName: 'Trovoada', startTime: '2026-10-08T18:00:00', endTime: '2026-10-08T23:00:00' },
      // Ends long before the game.
      { idAreaAviso: 'LSB', awarenessLevelID: 'red', awarenessTypeName: 'Trovoada', startTime: '2026-10-08T03:00:00', endTime: '2026-10-08T06:00:00' },
    ];
    expect(ipmaWarning(warnings, 'LSB', '2026-10-08T19:30:00Z')).toEqual({ level: 'orange', kind: 'Vento' });
    expect(ipmaWarning(warnings, 'BGC', '2026-10-08T19:30:00Z')).toBeNull();
  });
});

describe('MET Norway', () => {
  it('maps symbols, keeping day and night', () => {
    expect(metCondition('clearsky_day')).toBe('sunny');
    expect(metCondition('fair_night')).toBe('clear');
    expect(metCondition('partlycloudy_day')).toBe('cloudy');
    expect(metCondition('fog')).toBe('cloudy');
    expect(metCondition('lightrainshowers_day')).toBe('showers');
    expect(metCondition('heavyrainandthunder')).toBe('rain');
    expect(metCondition('snow')).toBe('rain');
    expect(metCondition('')).toBeNull();
  });

  it('reads the slot nearest kick-off, wind in km/h, and no rain probability', () => {
    const payload = {
      properties: {
        timeseries: [
          {
            time: '2026-10-13T16:00:00Z',
            data: {
              instant: { details: { air_temperature: 11.2, wind_speed: 4.2 } },
              next_1_hours: { summary: { symbol_code: 'lightrain' }, details: { precipitation_amount: 0.6 } },
            },
          },
          {
            time: '2026-10-13T18:00:00Z',
            data: {
              instant: { details: { air_temperature: 9.6, wind_speed: 3 } },
              next_6_hours: { summary: { symbol_code: 'clearsky_night' }, details: {} },
            },
          },
        ],
      },
    };
    expect(metKickoffWeather(payload, '2026-10-13T16:45:00Z')).toEqual({
      source: 'met_norway',
      forecastFor: '2026-10-13T16:00:00.000Z',
      condition: 'rain',
      temperatureC: 11,
      rainProbability: null,
      windKmh: 15,
    });
    expect(metKickoffWeather(payload, '2026-10-13T18:30:00Z')?.condition).toBe('clear');
    expect(metKickoffWeather(payload, '2026-10-14T12:00:00Z')).toBeNull();
  });
});

describe('weatherNotice', () => {
  const base = { venueName: 'Estádio do Mar', kickoffAt: '2026-10-08T18:00:00Z' };

  it('tells who is going to take a raincoat when it rains on an uncovered stand, at Lisbon time', () => {
    expect(
      weatherNotice({ ...base, weather: { condition: 'cloudy', rainProbability: 80 }, warning: null, roof: 'parcial' })
    ).toEqual({
      title: 'Leva o impermeável',
      body: 'Há 80% de probabilidade de chuva no Estádio do Mar às 19:00 e a bancada só é coberta em parte.',
    });
    expect(
      weatherNotice({ ...base, weather: { condition: 'rain', rainProbability: null }, warning: null, roof: null })?.body
    ).toBe('Está prevista chuva no Estádio do Mar às 19:00 e não sabemos se a bancada é coberta.');
  });

  it('stays quiet under a full roof, in dry weather and below the threshold', () => {
    expect(weatherNotice({ ...base, weather: { condition: 'rain', rainProbability: 90 }, warning: null, roof: 'total' })).toBeNull();
    expect(weatherNotice({ ...base, weather: { condition: 'sunny', rainProbability: 39 }, warning: null, roof: 'nenhuma' })).toBeNull();
    expect(weatherNotice({ ...base, weather: { condition: 'cloudy', rainProbability: 40 }, warning: null, roof: 'nenhuma' })).not.toBeNull();
  });

  it('sends orange and red warnings whatever the roof, but not yellow ones', () => {
    const orange = weatherNotice({
      ...base,
      weather: { condition: 'sunny', rainProbability: 0 },
      warning: { level: 'orange', kind: 'Vento' },
      roof: 'total',
    });
    expect(orange?.title).toBe('Aviso laranja: vento');
    expect(orange?.body).toContain('aviso laranja de vento para a zona do Estádio do Mar à hora do jogo (19:00)');
    expect(
      weatherNotice({ ...base, weather: { condition: 'sunny', rainProbability: 0 }, warning: { level: 'yellow', kind: 'Vento' }, roof: 'total' })
    ).toBeNull();
  });
});
