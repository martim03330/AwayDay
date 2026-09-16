import type { ModoTransporte } from '@/mocks/tipos';
import { icons, type IconName } from '@/ui/icon';

/** Como se chama e como se desenha cada modo de transporte. */
export const modosTransporte: Record<ModoTransporte, { nome: string; icon: IconName }> = {
  metro: { nome: 'Metro', icon: icons.metro },
  autocarro: { nome: 'Autocarro', icon: icons.autocarro },
  comboio: { nome: 'Comboio', icon: icons.comboio },
  tvde: { nome: 'TVDE', icon: icons.tvde },
  'a-pe': { nome: 'A pé', icon: icons.aPe },
  carro: { nome: 'Carro', icon: icons.carro },
};
