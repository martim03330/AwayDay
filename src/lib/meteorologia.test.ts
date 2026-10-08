import { describe, expect, it } from 'vitest';

import { buildFixtureCatalog } from '@/features/fixtures/mappers';
import { bundledCatalogRows } from '@/features/fixtures/snapshot';
import { avisoMeteorologico, haPrevisaoDeChuva } from '@/lib/meteorologia';
import type { Meteorologia } from '@/mocks/tipos';

const seco: Meteorologia = { condicao: 'sol', temperatura: 24, probabilidadeChuva: 5, ventoKmh: 10 };

describe('haPrevisaoDeChuva', () => {
  it('counts rain without a probability (forecasts from abroad)', () => {
    expect(haPrevisaoDeChuva({ ...seco, condicao: 'chuva', probabilidadeChuva: null })).toBe(true);
    expect(haPrevisaoDeChuva({ ...seco, probabilidadeChuva: null })).toBe(false);
    expect(haPrevisaoDeChuva({ ...seco, probabilidadeChuva: 40 })).toBe(true);
  });
});

describe('avisoMeteorologico', () => {
  it('shows an IPMA warning first, even under a full roof', () => {
    const aviso = avisoMeteorologico({ ...seco, aviso: { nivel: 'laranja', tipo: 'Vento' } }, { roofCoverage: 'total' });
    expect(aviso).toEqual({
      titulo: 'Aviso laranja do IPMA',
      mensagem: 'Vento (aviso laranja) na zona do estádio à hora do jogo. Vai com tempo e atento às indicações.',
    });
  });

  it('warns about rain only where the stand is not fully covered', () => {
    const chuva: Meteorologia = { ...seco, condicao: 'aguaceiros', probabilidadeChuva: 70 };
    expect(avisoMeteorologico(chuva, { roofCoverage: 'total' })).toBeNull();
    expect(avisoMeteorologico(chuva, { roofCoverage: 'nenhuma' })?.mensagem).toBe(
      '70% de probabilidade de chuva e o estádio não tem cobertura. Impermeável no bolso.'
    );
    expect(avisoMeteorologico({ ...chuva, probabilidadeChuva: null }, { roofCoverage: 'parcial' })?.mensagem).toBe(
      'Chuva prevista e o estádio só tem cobertura parcial. Leva impermeável ou escolhe bem o lugar.'
    );
    expect(avisoMeteorologico(seco, { roofCoverage: 'nenhuma' })).toBeNull();
    expect(avisoMeteorologico(null, { roofCoverage: 'nenhuma' })).toBeNull();
  });
});

describe('weather in the catalogue', () => {
  const order = { venues: [], clubs: [] };
  const fixture = bundledCatalogRows.fixtures[0];

  it('joins the forecast to its fixture, in the app words', () => {
    const catalog = buildFixtureCatalog(
      {
        ...bundledCatalogRows,
        fixtures: [fixture],
        weather: [
          {
            fixture_id: fixture.id,
            source: 'ipma',
            condition: 'showers',
            temperature_c: 17,
            rain_probability: 62,
            wind_kmh: 21,
            warning_level: 'yellow',
            warning_kind: 'Precipitação',
          },
        ],
      },
      { fixtures: {}, venues: {} },
      order
    );
    expect(catalog.fixtures[0].meteorologia).toEqual({
      condicao: 'aguaceiros',
      temperatura: 17,
      probabilidadeChuva: 62,
      ventoKmh: 21,
      fonte: 'IPMA',
      aviso: { nivel: 'amarelo', tipo: 'Precipitação' },
    });
  });

  it('shows nothing for an unknown condition or a fixture with no forecast', () => {
    const catalog = buildFixtureCatalog(
      {
        ...bundledCatalogRows,
        fixtures: [fixture],
        weather: [
          {
            fixture_id: fixture.id,
            source: 'met_norway',
            condition: 'tornado',
            temperature_c: 10,
            rain_probability: null,
            wind_kmh: 5,
            warning_level: null,
            warning_kind: null,
          },
        ],
      },
      { fixtures: {}, venues: {} },
      order
    );
    expect(catalog.fixtures[0].meteorologia).toBeNull();
  });
});
