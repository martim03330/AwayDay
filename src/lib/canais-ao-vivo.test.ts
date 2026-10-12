import { describe, expect, it } from 'vitest';

import { canalLigado, intervaloDaConversa, marcarCanal } from '@/lib/canais-ao-vivo';

describe('canais ao vivo', () => {
  it('refreshes often without the channel and rarely with it', () => {
    expect(intervaloDaConversa('group:a', 30_000)).toBe(30_000);
    marcarCanal('group:a', true);
    expect(canalLigado('group:a')).toBe(true);
    expect(intervaloDaConversa('group:a', 30_000)).toBe(300_000);
    expect(intervaloDaConversa('group:b', 30_000)).toBe(30_000);
  });

  it('goes back to refreshing often when the channel drops', () => {
    marcarCanal('ride:x', true);
    marcarCanal('ride:x', false);
    expect(canalLigado('ride:x')).toBe(false);
    expect(intervaloDaConversa('ride:x', 15_000)).toBe(15_000);
  });
});
