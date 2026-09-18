import type { CategoriaDespesa } from '@/features/trips/api';
import { icons, type IconName } from '@/ui/icon';

/** Como cada tipo de despesa se diz e se desenha. */
export const CATEGORIA: Record<CategoriaDespesa, { nome: string; icon: IconName }> = {
  cerveja: { nome: 'Cervejas', icon: icons.brinde },
  petiscos: { nome: 'Petiscos', icon: icons.tasco },
  refeicao: { nome: 'Refeição', icon: icons.especialidade },
  bilhetes: { nome: 'Bilhetes', icon: icons.estadio },
  casa: { nome: 'Casa', icon: icons.casa },
  boleia: { nome: 'Boleia', icon: icons.carro },
  portagens: { nome: 'Portagens', icon: icons.rota },
  outro: { nome: 'Outro', icon: icons.preco },
};
