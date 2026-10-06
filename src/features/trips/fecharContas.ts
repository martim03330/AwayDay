import type { TripBalance } from '@/features/trips/api';
import { acertarContas, type Transferencia } from '@/lib/acerto';

/**
 * The transfers that close the trip's accounts, from the server's balances. The balances always add up to zero; if
 * one day they don't, this returns `null` so the screen can say it can't close them instead of crashing.
 */
export function fecharContas(saldos: TripBalance[]): Transferencia[] | null {
  try {
    return acertarContas(
      saldos.map((pessoa) => ({
        profileId: pessoa.profileId,
        nome: pessoa.displayName,
        saldoCentimos: pessoa.balanceCents,
      }))
    );
  } catch {
    return null;
  }
}

/** "Rui", "Rui e Ana", "Rui, Ana e João" — first names only. */
export function juntarNomes(nomes: string[]) {
  const primeiros = nomes.map((nome) => nome.split(' ')[0]);
  if (primeiros.length <= 1) return primeiros.join('');
  return `${primeiros.slice(0, -1).join(', ')} e ${primeiros[primeiros.length - 1]}`;
}
