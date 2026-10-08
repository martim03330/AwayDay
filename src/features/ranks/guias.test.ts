import { describe, expect, it } from 'vitest';

import { guiaDaMissao } from '@/features/ranks/guias';

describe('guiaDaMissao', () => {
  it('every kind of mission in the catalogue has a short guide and one action', () => {
    const metricas = ['stadium', 'stadium_visit', 'new_stadium', 'away_game', 'district', 'tasco', 'tasco_checkin',
      'new_tasco', 'tasco_photo', 'review', 'specialty', 'proof_photo'];
    for (const metrica of metricas) {
      const guia = guiaDaMissao(metrica);
      expect(guia, metrica).not.toBeNull();
      expect(guia?.passos.length, metrica).toBeGreaterThanOrEqual(2);
      expect(guia?.passos.length, metrica).toBeLessThanOrEqual(3);
    }
  });

  it('sends each kind to the right place', () => {
    expect(guiaDaMissao('proof_photo')?.acao.tipo).toBe('abrir-camara');
    expect(guiaDaMissao('away_game')?.acao.tipo).toBe('ver-jogos');
    expect(guiaDaMissao('tasco_photo')?.acao.tipo).toBe('ver-tascos');
  });

  it('knows nothing of an unknown kind (or of inherited keys)', () => {
    expect(guiaDaMissao('nao-existe')).toBeNull();
    expect(guiaDaMissao('toString')).toBeNull();
  });
});
