import { useColorScheme } from 'react-native';

import { Colors, ColorsEscuro, type Paleta } from '@/constants/theme';
import { useAppState } from '@/state/app-state';

/** O que o utilizador escolheu nas definições. `sistema` segue o telemóvel. */
export type Tema = 'sistema' | 'claro' | 'escuro';

/**
 * A paleta a usar agora.
 *
 * Por omissão segue o telemóvel: quem tem o sistema em escuro abre a app em escuro. Quem quiser fixar um dos dois
 * fixa-o nas definições, e aí o sistema deixa de mandar.
 */
export function useTheme(): Paleta {
  const { tema } = useAppState();
  const doSistema = useColorScheme();
  const escuro = tema === 'escuro' || (tema === 'sistema' && doSistema === 'dark');
  return escuro ? ColorsEscuro : Colors;
}

/** O mesmo, mas só a resposta: serve para quem precisa de saber se está escuro (barras de estado, mapas). */
export function useEstaEscuro() {
  const { tema } = useAppState();
  const doSistema = useColorScheme();
  return tema === 'escuro' || (tema === 'sistema' && doSistema === 'dark');
}
