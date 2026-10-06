import { describe, expect, it } from 'vitest';

import {
  conquistasPorFamilia,
  progressoNoNivel,
  proximoTitulo,
  segundaFeiraDe,
  tituloDoNivel,
  zonaDaDivisao,
} from '@/features/ranks/labels';
import type { Mission } from '@/features/ranks/types';

describe('tituloDoNivel', () => {
  it('changes exactly at each threshold', () => {
    expect(tituloDoNivel(1)).toBe('Estreante');
    expect(tituloDoNivel(4)).toBe('Estreante');
    expect(tituloDoNivel(5)).toBe('Adepto');
    expect(tituloDoNivel(9)).toBe('Adepto');
    expect(tituloDoNivel(10)).toBe('Habitual');
    expect(tituloDoNivel(15)).toBe('Viajante');
    expect(tituloDoNivel(20)).toBe('Bancada Fiel');
    expect(tituloDoNivel(30)).toBe('Veterano');
    expect(tituloDoNivel(40)).toBe('Lenda');
    expect(tituloDoNivel(99)).toBe('Lenda');
  });

  it('falls back to the first title below level 1', () => {
    expect(tituloDoNivel(0)).toBe('Estreante');
  });
});

describe('proximoTitulo', () => {
  it('names the next title and its level', () => {
    expect(proximoTitulo(1)).toEqual({ nivel: 5, titulo: 'Adepto' });
    expect(proximoTitulo(5)).toEqual({ nivel: 10, titulo: 'Habitual' });
    expect(proximoTitulo(39)).toEqual({ nivel: 40, titulo: 'Lenda' });
  });

  it('is null at the last title', () => {
    expect(proximoTitulo(40)).toBeNull();
  });
});

describe('progressoNoNivel', () => {
  it('is the share of the way between the two levels', () => {
    expect(progressoNoNivel({ totalXp: 1350, levelXp: 1350, nextLevelXp: 1750 })).toBe(0);
    expect(progressoNoNivel({ totalXp: 1550, levelXp: 1350, nextLevelXp: 1750 })).toBe(0.5);
  });

  it('stays between 0 and 1', () => {
    expect(progressoNoNivel({ totalXp: 2000, levelXp: 1350, nextLevelXp: 1750 })).toBe(1);
    expect(progressoNoNivel({ totalXp: 0, levelXp: 100, nextLevelXp: 300 })).toBe(0);
  });

  it('is full at the level cap, where both ends meet', () => {
    expect(progressoNoNivel({ totalXp: 300000, levelXp: 247450, nextLevelXp: 247450 })).toBe(1);
  });
});

describe('zonaDaDivisao', () => {
  const base = {
    division: 3 as const,
    divisionPosition: 1,
    divisionSize: 10,
    promotionSpots: 2,
    relegationSpots: 2,
    seasonXp: 800,
    promotionMinXp: 500,
  };

  it('top spots with enough points go up', () => {
    expect(zonaDaDivisao(base)).toBe('subida');
    expect(zonaDaDivisao({ ...base, divisionPosition: 2 })).toBe('subida');
  });

  it('top spot without enough points stays', () => {
    expect(zonaDaDivisao({ ...base, seasonXp: 499 })).toBe('meio');
  });

  it('bottom spots go down', () => {
    expect(zonaDaDivisao({ ...base, divisionPosition: 9 })).toBe('descida');
    expect(zonaDaDivisao({ ...base, divisionPosition: 8 })).toBe('meio');
  });

  it('nobody goes up from the top division or down from the bottom one', () => {
    expect(zonaDaDivisao({ ...base, division: 1 })).toBe('meio');
    expect(zonaDaDivisao({ ...base, division: 5, divisionPosition: 10 })).toBe('meio');
  });

  it('a blank season is relegation, except where there is nowhere to drop', () => {
    expect(zonaDaDivisao({ ...base, seasonXp: 0 })).toBe('descida');
    expect(zonaDaDivisao({ ...base, division: 5, seasonXp: 0 })).toBe('meio');
  });
});

function missao(partial: Partial<Mission> & Pick<Mission, 'id' | 'family'>): Mission {
  return {
    kind: 'achievement',
    tier: null,
    needsProofPhoto: false,
    target: 1,
    xp: 100,
    title: partial.id,
    description: '',
    badge: null,
    icon: 'estadio',
    proofHint: null,
    sort: 0,
    weekStart: null,
    progress: 0,
    completedAt: null,
    ...partial,
  };
}

describe('conquistasPorFamilia', () => {
  it('shows the first tier not done, with the done ones as earned', () => {
    const [estadios] = conquistasPorFamilia([
      missao({ id: 'dez', family: 'estadios', tier: 2, sort: 11 }),
      missao({ id: 'tres', family: 'estadios', tier: 1, sort: 10, completedAt: '2026-10-01T15:00:00Z' }),
      missao({ id: 'vinte-e-cinco', family: 'estadios', tier: 3, sort: 12 }),
    ]);
    expect(estadios?.atual.id).toBe('dez');
    expect(estadios?.ganhos.map((m) => m.id)).toEqual(['tres']);
  });

  it('shows the top tier once every tier is done', () => {
    const feito = '2026-10-01T15:00:00Z';
    const [estadios] = conquistasPorFamilia([
      missao({ id: 'tres', family: 'estadios', tier: 1, completedAt: feito }),
      missao({ id: 'dez', family: 'estadios', tier: 2, completedAt: feito }),
    ]);
    expect(estadios?.atual.id).toBe('dez');
    expect(estadios?.ganhos).toHaveLength(2);
  });

  it('ignores season missions and weekly challenges, and keeps the catalogue order', () => {
    const familias = conquistasPorFamilia([
      missao({ id: 'tascos', family: 'tascos', sort: 50 }),
      missao({ id: 'semana', family: 'semana-jogo', kind: 'weekly' }),
      missao({ id: 'epoca', family: 'epoca-jogos', kind: 'season' }),
      missao({ id: 'estadios', family: 'estadios', sort: 10 }),
    ]);
    expect(familias.map((familia) => familia.atual.id)).toEqual(['estadios', 'tascos']);
  });
});

describe('segundaFeiraDe', () => {
  it('a Monday is its own week', () => {
    expect(segundaFeiraDe('2026-10-05')).toBe('2026-10-05');
  });

  it('Sunday still belongs to the week that started on Monday', () => {
    expect(segundaFeiraDe('2026-10-11')).toBe('2026-10-05');
  });

  it('crosses months and years', () => {
    expect(segundaFeiraDe('2026-11-01')).toBe('2026-10-26');
    expect(segundaFeiraDe('2027-01-02')).toBe('2026-12-28');
  });
});
