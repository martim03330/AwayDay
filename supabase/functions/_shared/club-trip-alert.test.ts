import { describe, expect, it } from 'vitest';

import { alertTitle } from './club-trip-alert';

describe('alertTitle', () => {
  it('names the Casa, the game, the first stop and its time in Lisbon', () => {
    expect(
      alertTitle('Casa do Benfica de Coimbra', 'Benfica x Alverca', 'Coimbra B', '2026-11-02T16:00:00Z')
    ).toEqual({
      title: 'Autocarro da Casa do Benfica de Coimbra',
      body: 'Benfica x Alverca: sai de Coimbra B às 16:00.',
    });
  });

  it('shows summer time as Lisbon reads it (UTC+1)', () => {
    expect(alertTitle('Casa do Porto de Braga', 'Porto x Braga', 'Sede', '2026-08-15T18:30:00Z').body).toBe(
      'Porto x Braga: sai de Sede às 19:30.'
    );
  });

  it('keeps the minutes and a leading zero on the hour', () => {
    expect(alertTitle('Casa X', 'A x B', 'Praça', '2026-12-01T08:05:00Z').body).toBe('A x B: sai de Praça às 08:05.');
  });
});
