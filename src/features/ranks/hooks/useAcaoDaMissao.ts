import { useRouter } from 'expo-router';

import type { AcaoDaMissao } from '@/features/ranks/guias';
import type { Mission } from '@/features/ranks/types';
import { useTirarFoto } from '@/hooks/use-tirar-foto';

/** What a mission's button does: open the camera for a proof photo, or go to the games or the tascos near you. */
export function useAcaoDaMissao() {
  const router = useRouter();
  const tirarFoto = useTirarFoto();
  return (missao: Mission, acao: AcaoDaMissao) => {
    // Proof photos can show someone else: the camera asks for their permission first.
    if (acao === 'abrir-camara') tirarFoto({ id: missao.id, fotoComOutraPessoa: true });
    else router.navigate(acao === 'ver-jogos' ? '/jogos' : '/locais');
  };
}
