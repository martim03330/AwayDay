import { type Paleta } from '@/constants/theme';
import { type Facilidade } from '@/lib/facilidade-estacionamento';

// The colour of a car park: how easy it probably is to park there. An estimate from distance, size and known
// closures — never live occupancy, which nobody publishes for free. Next to the colour, every car park says it in
// words («Enche cedo»), so there is no separate legend.

/** The colour for a dot or a marker. */
export function corFacilidade(theme: Paleta, nivel: Facilidade) {
  if (nivel === 'facil') return theme.success;
  if (nivel === 'media') return theme.warning;
  if (nivel === 'dificil') return theme.danger;
  return theme.textMuted;
}
