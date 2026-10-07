import { loadFont as carregarBigShoulders } from '@remotion/google-fonts/BigShoulders';
import { loadFont as carregarFigtree } from '@remotion/google-fonts/Figtree';

/** The app's own colours (src/constants/theme.ts) and fonts. */
export const COR = {
  papel: '#F8F7F2',
  tinta: '#13241B',
  tintaSuave: '#56675D',
  relva: '#187C44',
  relvaClara: '#1C8A4D',
  relvaEscura: '#0E5530',
  amarelo: '#FFCE3A',
  branco: '#FFFFFF',
  linha: '#E2DFD3',
  braga: '#D8262E',
};

export const LETRA_TITULO = carregarBigShoulders('normal', { weights: ['800', '900'], subsets: ['latin', 'latin-ext'] }).fontFamily;
export const LETRA_TEXTO = carregarFigtree('normal', { weights: ['500', '700', '800'], subsets: ['latin', 'latin-ext'] }).fontFamily;
