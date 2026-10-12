import { describe, expect, it } from 'vitest';

import { datasDaEstadia } from '@/lib/dormida';
import {
  AEROPORTOS,
  aeroportoMaisPerto,
  avisoDeBoleiaNaIlha,
  avisoDeBoleiaPelaRegiao,
  linkGoogleFlights,
  partidaNaIlha,
  precisaDeVoo,
} from '@/lib/voos';

const lisboa = AEROPORTOS.find((a) => a.codigo === 'LIS')!;

describe('precisaDeVoo', () => {
  it('flies to the islands and abroad', () => {
    expect(precisaDeVoo('estrangeiro', 'continente')).toBe(true);
    expect(precisaDeVoo('madeira', 'continente')).toBe(true);
    expect(precisaDeVoo('acores', null)).toBe(true);
  });

  it('flies from the islands to the mainland', () => {
    expect(precisaDeVoo('continente', 'acores')).toBe(true);
    expect(precisaDeVoo('continente', 'madeira')).toBe(true);
  });

  it('does not fly within the mainland, however far', () => {
    expect(precisaDeVoo('continente', 'continente')).toBe(false);
    expect(precisaDeVoo('continente', null)).toBe(false);
  });
});

describe('aeroportoMaisPerto', () => {
  it('picks the nearest airport to where you leave from', () => {
    expect(aeroportoMaisPerto({ latitude: 41.55, longitude: -8.42 }).codigo).toBe('OPO'); // Braga
    expect(aeroportoMaisPerto({ latitude: 38.52, longitude: -8.89 }).codigo).toBe('LIS'); // Setúbal
    expect(aeroportoMaisPerto({ latitude: 37.1, longitude: -8.67 }).codigo).toBe('FAO'); // Lagos
    expect(aeroportoMaisPerto({ latitude: 32.65, longitude: -16.91 }).codigo).toBe('FNC'); // Funchal
    expect(aeroportoMaisPerto({ latitude: 37.74, longitude: -25.67 }).codigo).toBe('PDL'); // Ponta Delgada
    expect(aeroportoMaisPerto({ latitude: 38.65, longitude: -27.22 }).codigo).toBe('TER'); // Angra do Heroísmo
  });

  it('falls back to Lisbon when we do not know where you leave from', () => {
    expect(aeroportoMaisPerto(null).codigo).toBe('LIS');
  });
});

describe('linkGoogleFlights', () => {
  // Kick-off on 13 October at 17:45 in Lisbon: fly the day before, two nights.
  const estadia = datasDaEstadia('2026-10-13T16:45:00.000Z', 2);

  it('opens a round-trip search with the airport, the city and the stay dates', () => {
    const url = new URL(linkGoogleFlights({ origem: lisboa, cidade: 'Lens', pais: 'França', estadia }));
    expect(url.origin + url.pathname).toBe('https://www.google.com/travel/flights');
    expect(url.searchParams.get('q')).toBe('Flights from LIS to Lens, França on 2026-10-12 through 2026-10-14');
    expect(url.searchParams.get('hl')).toBe('pt-PT');
    expect(url.searchParams.get('curr')).toBe('EUR');
  });

  it('keeps accents and spaces safe in the link', () => {
    const link = linkGoogleFlights({ origem: lisboa, cidade: ' Ponta Delgada ', pais: 'Portugal', estadia });
    expect(link).not.toContain(' ');
    expect(new URL(link).searchParams.get('q')).toContain('to Ponta Delgada, Portugal on');
  });

  it('leaves the country out when we do not have it', () => {
    const link = linkGoogleFlights({ origem: lisboa, cidade: 'Milão', pais: '', estadia });
    expect(new URL(link).searchParams.get('q')).toBe('Flights from LIS to Milão on 2026-10-12 through 2026-10-14');
  });
});

describe('boleias para jogos nas ilhas', () => {
  const funchal = { latitude: 32.646, longitude: -16.928 };
  const pontaDelgada = { latitude: 37.748, longitude: -25.667 };

  it('only warns for the islands', () => {
    expect(avisoDeBoleiaNaIlha('madeira')?.titulo).toBe('Jogo na Madeira');
    expect(avisoDeBoleiaNaIlha('acores')?.titulo).toBe('Jogo nos Açores');
    expect(avisoDeBoleiaNaIlha('continente')).toBeNull();
    expect(avisoDeBoleiaNaIlha('estrangeiro')).toBeNull();
  });

  it('warns on rides abroad and to the islands, never on the mainland', () => {
    expect(avisoDeBoleiaPelaRegiao('estrangeiro')?.titulo).toBe('Jogo fora de Portugal');
    expect(avisoDeBoleiaPelaRegiao('madeira')?.titulo).toBe('Jogo na Madeira');
    expect(avisoDeBoleiaPelaRegiao('acores')?.titulo).toBe('Jogo nos Açores');
    expect(avisoDeBoleiaPelaRegiao('continente')).toBeNull();
  });

  it('a meeting point must be on the island of the stadium', () => {
    expect(partidaNaIlha({ latitude: 32.74, longitude: -16.69 }, funchal)).toBe(true); // Machico
    expect(partidaNaIlha({ latitude: 38.72, longitude: -9.14 }, funchal)).toBe(false); // Lisboa
    expect(partidaNaIlha({ latitude: 37.82, longitude: -25.15 }, pontaDelgada)).toBe(true); // Nordeste, São Miguel
    expect(partidaNaIlha({ latitude: 38.66, longitude: -27.22 }, pontaDelgada)).toBe(false); // Terceira
  });
});
