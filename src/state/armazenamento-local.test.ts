import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

const { converterPreferencias, PREFERENCIAS_INICIAIS } = await import('@/state/armazenamento-local');

describe('converterPreferencias', () => {
  it('starts with the lock and hidden amounts off', () => {
    expect(PREFERENCIAS_INICIAIS.bloqueioAoAbrir).toBe(false);
    expect(PREFERENCIAS_INICIAIS.esconderValores).toBe(false);
    expect(converterPreferencias(null)).toEqual(PREFERENCIAS_INICIAIS);
  });

  it('keeps them off for preferences saved before they existed', () => {
    const antigas = converterPreferencias({ onboardingConcluido: true, tema: 'escuro' });
    expect(antigas.bloqueioAoAbrir).toBe(false);
    expect(antigas.esconderValores).toBe(false);
    expect(antigas.onboardingConcluido).toBe(true);
  });

  it('reads them when saved', () => {
    const guardadas = converterPreferencias({ bloqueioAoAbrir: true, esconderValores: true });
    expect(guardadas.bloqueioAoAbrir).toBe(true);
    expect(guardadas.esconderValores).toBe(true);
  });

  it('ignores anything that is not a boolean', () => {
    const estranhas = converterPreferencias({ bloqueioAoAbrir: 'sim', esconderValores: 1 });
    expect(estranhas.bloqueioAoAbrir).toBe(false);
    expect(estranhas.esconderValores).toBe(false);
  });
});
