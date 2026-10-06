import { StyleSheet, View, type ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type Paleta } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

const rect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}` +
  `h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

const PIN = 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z';
const HOUSE = ['M3 10.5L12 3l9 7.5', 'M5 9v11h14V9'];
const CHECK = 'M5 12.5l4.5 4.5L19 7.5';

type Glyph = { paths: readonly string[]; filled?: boolean };

/** "Relvado" icon set: 24 px grid, 2 px stroke, round caps. No emoji in the interface. */
const glyphs = {
  jogos: {
    paths: [
      circle(12, 12, 9),
      'M12 7.6l3.7 2.7-1.4 4.4H9.7l-1.4-4.4z',
      'M12 3v4.6M20.6 9.6l-4.9.7M17.3 19.2l-3-4.5M6.7 19.2l3-4.5M3.4 9.6l4.9.7',
    ],
  },
  locais: { paths: [PIN, circle(12, 10, 2.5)] },
  perfil: { paths: [circle(12, 8, 4), 'M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6'] },
  estadio: {
    paths: [
      ellipse(12, 8.5, 9, 3.8),
      'M3 8.5v6.5c0 2.1 4 3.8 9 3.8s9-1.7 9-3.8V8.5',
      'M7.5 12.2v5.8M12 12.3v6.5M16.5 12.2v5.8',
    ],
  },
  metro: { paths: [rect(5, 3, 14, 14, 3), 'M5 10.5h14M8.5 21l2-4M15.5 21l-2-4'] },
  autocarro: { paths: [rect(4, 3, 16, 15, 3), 'M4 10h16M7.5 21v-3M16.5 21v-3'] },
  comboio: {
    paths: [
      'M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5z',
      'M8 3.1V7a4 4 0 0 0 8 0V3.1',
      'M9 15h.01M15 15h.01M8 19l-2 3M16 19l2 3',
    ],
  },
  tvde: {
    paths: [
      'M5 10l1.5-3.7A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.3L19 10',
      rect(3, 10, 18, 8, 2),
      'M7 14h.01M17 14h.01M5 18v2M19 18v2M10 2.5h4',
    ],
  },
  carro: {
    paths: [
      'M5 10l1.5-3.7A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.3L19 10',
      rect(3, 10, 18, 8, 2),
      'M7 14h.01M17 14h.01M5 18v2M19 18v2',
    ],
  },
  aPe: {
    paths: [
      circle(13.5, 4.5, 1.8),
      'M10 21l2.2-6.2L9.5 12l1.2-4.5 3.3 2.8 3 1.2M10.7 7.5L7.5 9.5V13M12.2 14.8L15 21',
    ],
  },
  sol: {
    paths: [
      circle(12, 12, 4),
      'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4',
    ],
  },
  limpo: { paths: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z'] },
  nublado: { paths: ['M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z'] },
  aguaceiros: {
    paths: [
      'M7 14.5a4.5 4.5 0 1 1 1.3-8.8A5.5 5.5 0 0 1 18.4 8.5a3.2 3.2 0 0 1-.9 6z',
      'M9 18v.01M13 18v.01M17 18v.01M11 21v.01M15 21v.01',
    ],
  },
  chuva: {
    paths: [
      'M7 14.5a4.5 4.5 0 1 1 1.3-8.8A5.5 5.5 0 0 1 18.4 8.5a3.2 3.2 0 0 1-.9 6z',
      'M9 17.5l-1 3M13 17.5l-1 3M17 17.5l-1 3',
    ],
  },
  probabilidadeChuva: {
    paths: [
      'M12 21.5a6.5 6.5 0 0 0 6.5-6.5c0-3.5-2.6-6.8-6.5-12-3.9 5.2-6.5 8.5-6.5 12a6.5 6.5 0 0 0 6.5 6.5z',
    ],
  },
  vento: {
    paths: [
      'M12.8 19.6A2 2 0 1 0 14 16H2',
      'M17.5 8a2.5 2.5 0 1 1 2 4H2',
      'M9.8 4.4A2 2 0 1 1 11 8H2',
    ],
  },
  seguinte: { paths: ['M9 5l7 7-7 7'] },
  voltar: { paths: ['M15 5l-7 7 7 7'] },
  fechar: { paths: ['M6 6l12 12M18 6L6 18'] },
  lista: { paths: ['M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01'] },
  visitado: {
    paths: [
      'M3.9 8.6a4 4 0 0 1 4.7-4.7 4 4 0 0 1 6.8 0 4 4 0 0 1 4.7 4.7 4 4 0 0 1 0 6.8 4 4 0 0 1-4.7 4.7 4 4 0 0 1-6.8 0 4 4 0 0 1-4.7-4.7 4 4 0 0 1 0-6.8z',
      'M9 12l2 2 4-4',
    ],
  },
  selecionado: { paths: [circle(12, 12, 9), 'M8 12.5l2.8 2.8 5.7-5.8'] },
  checkIn: { paths: [PIN, 'M9.3 10l1.9 1.9 3.6-3.6'] },
  checkInFeito: { paths: [CHECK] },
  especialidade: { paths: ['M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1.5-3 4-3 7h3v11'] },
  horario: { paths: [circle(12, 12, 9), 'M12 7v5l3.2 2'] },
  semJogos: {
    paths: [rect(3.5, 5, 17, 15, 2), 'M3.5 10h17M8 3v4M16 3v4', 'M10 13.5l4 4M14 13.5l-4 4'],
  },
  semLocais: {
    paths: [
      'M9.3 4.3A6.5 6.5 0 0 1 18.5 10c0 1.6-.6 3.3-1.4 4.8M15 17.9C13.5 19.8 12 21 12 21s-6.5-5.6-6.5-11c0-.9.2-1.8.5-2.6',
      'M3 3l18 18',
    ],
  },
  naoEncontrado: {
    paths: [circle(12, 12, 9), 'M9.5 9.2a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.3-2.5 3.8', 'M12 17h.01'],
  },
  erro: { paths: [circle(12, 12, 9), 'M12 7.5v5.5M12 16.5h.01'] },
  cobertura: { paths: ['M3 12a9 9 0 0 1 18 0z', 'M12 12v6.5a2 2 0 0 1-4 0'] },
  sombra: {
    paths: [
      'M12 3v2M5.6 5.6L7 7M18.4 5.6L17 7M3 12h2M19 12h2',
      'M7.5 12a4.5 4.5 0 0 1 9 0',
      'M3 16h18M6 20h12',
    ],
  },
  abrigo: { paths: [...HOUSE, 'M10 20v-6h4v6'] },
  casa: {
    paths: [
      ...HOUSE,
      'M12 17.5s-2.5-1.6-2.5-3.4a1.3 1.3 0 0 1 2.5-.6 1.3 1.3 0 0 1 2.5.6c0 1.8-2.5 3.4-2.5 3.4z',
    ],
  },
  aviso: {
    paths: [
      'M10.3 3.9L2.4 17.5a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
      'M12 9v4.5M12 17h.01',
    ],
  },
  rota: {
    paths: [
      'M10.6 2.6a2 2 0 0 1 2.8 0l8 8a2 2 0 0 1 0 2.8l-8 8a2 2 0 0 1-2.8 0l-8-8a2 2 0 0 1 0-2.8z',
      'M9 14v-2.5a1.5 1.5 0 0 1 1.5-1.5H15',
      'M13 8l2 2-2 2',
    ],
  },
  aviao: {
    paths: [
      'M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
    ],
  },
  estrela: {
    paths: ['M12 2.8l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.1 6.4 20l1.1-6.2L3 9.4l6.2-.9z'],
    filled: true,
  },
  pontoEncontro: { paths: ['M12 21V3l7 3.5-7 3.5', 'M8 21h8'] },
  missao: { paths: ['M5 21V4M5 4h12l-2 4 2 4H5'] },
  ranking: {
    paths: [
      'M7 4h10v5a5 5 0 0 1-10 0z',
      'M7 6H4.5a2.8 2.8 0 0 0 2.8 3.8M17 6h2.5a2.8 2.8 0 0 1-2.8 3.8M12 14v3.5M8 21h8M9.5 21v-3.5h5V21',
    ],
  },
  tasco: {
    paths: [
      'M5 9h10v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z',
      'M15 11.5h2a2.5 2.5 0 0 1 0 5h-2',
      'M5.5 9C5 6.8 6.6 5.2 8.5 5.6 9.4 3.9 12.3 3.8 13.2 5.6c1.8-.2 2.8 1.6 2 3.4',
    ],
  },
  porVerificar: {
    paths: [
      'M6 2.5h12M6 21.5h12',
      'M7 2.5v3.2a5 5 0 0 0 2 4L12 12l3-2.3a5 5 0 0 0 2-4V2.5',
      'M7 21.5v-3.2a5 5 0 0 1 2-4L12 12l3 2.3a5 5 0 0 1 2 4v3.2',
    ],
  },
  localizacao: { paths: ['M3 11l18-8-8 18-2-8z'] },
  cidade: { paths: ['M9 4L3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5z', 'M9 4v13.5M15 6.5V20'] },
  som: { paths: ['M11 5L6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13'] },
  notificacoes: { paths: ['M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z', 'M10 21h4'] },
  wc: {
    paths: [
      circle(7, 4.8, 1.7),
      circle(17, 4.8, 1.7),
      'M5.5 21v-5.5H4.3L5.6 9h2.8l1.3 6.5H8.5V21M17 8.5V21M15 9h4v6.5',
    ],
  },
  preco: { paths: [circle(12, 12, 9), 'M15 8.5a4 4 0 1 0 0 7', 'M7.5 11h5M7.5 13.5h5'] },
  acessivel: { paths: [circle(10, 4.5, 1.8), 'M10 8v6h6l2.5 5', 'M7 11.5a5.5 5.5 0 1 0 8 6.5'] },
  acesso: {
    paths: ['M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z', 'M15 7.5v2M15 11v2M15 14.5v2'],
  },
  quente: {
    paths: [
      'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z',
    ],
  },
  agua: {
    paths: [
      'M10 2h4',
      'M10 2v3L8.5 7A3 3 0 0 0 8 8.7V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8.7a3 3 0 0 0-.5-1.7L14 5V2',
      'M8 12h8',
    ],
  },
  microfone: { paths: [rect(9, 3, 6, 11, 3), 'M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21'] },
  introducao: {
    paths: [
      'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
      'M19 3v4M17 5h4',
      'M5 17v3M3.5 18.5h3',
    ],
  },
  demo: {
    paths: [
      'M3 21l9-9',
      'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M12.2 6.2L11 5',
      'M15 9h.01',
    ],
  },
  camara: { paths: ['M4 8h3.2l1.8-3h6l1.8 3H20v11H4z', circle(12, 13, 3.4)] },
  album: {
    paths: [
      rect(3, 6, 14, 14, 2),
      'M7 3h12a2 2 0 0 1 2 2v12',
      circle(8.5, 11, 1.5),
      'M17 16l-3.5-3.5L6 20',
    ],
  },
  definicoes: {
    paths: [
      'M4 6h9M17 6h3',
      circle(15, 6, 2),
      'M4 12h3M11 12h9',
      circle(9, 12, 2),
      'M4 18h11M19 18h1',
      circle(17, 18, 2),
    ],
  },
  espreitar: { paths: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', circle(12, 12, 3)] },
  brinde: {
    paths: [
      'M5 3h5l-.5 6a2 2 0 0 1-4 0z',
      'M14 3h5l.5 6a2 2 0 0 1-4 0z',
      'M7.5 11v9M16.5 11v9M5.5 20h4M14.5 20h4',
    ],
  },
  recomecar: { paths: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'] },
  silencio: { paths: ['M11 5L6 9H3v6h3l5 4z', 'M16 9l5 6M21 9l-5 6'] },
  cafe: {
    paths: [
      'M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z',
      'M17 11h1.5a2.5 2.5 0 0 1 0 5H17',
      'M8 3v3M12 3v3',
    ],
  },
  megafone: { paths: ['M3 11l18-5v12L3 14z', 'M11.6 16.8a3 3 0 1 1-5.8-1.6'] },
  explosao: {
    paths: [
      'M12 2l2.2 5.3L20 5l-2.3 5.8L23 13l-5.6 1.7L19 21l-5.2-3.4L12 23l-1.8-5.4L5 21l1.6-6.3L1 13l5.3-2.2L4 5l5.8 2.3z',
    ],
  },
  treinador: { paths: ['M3 13a5.5 5.5 0 1 0 11 0v-1.5h7V8H9', circle(8.5, 13, 1.6), 'M13 8V5'] },
  calendario: { paths: [rect(3.5, 5, 17, 15, 2), 'M3.5 10h17M8 3v4M16 3v4'] },
  partilhar: { paths: ['M12 3v12M7 8l5-5 5 5M5 13v7h14v-7'] },
  /** Avião de papel: mandar uma mensagem. */
  enviar: { paths: ['M21.5 2.5L10.5 13.5', 'M21.5 2.5l-7 19-4-8-8-4z'] },
  /** Balão de conversa. */
  conversa: {
    paths: [
      'M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.3A8.5 8.5 0 1 1 20.5 11.5z',
      'M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01',
    ],
  },
  email: { paths: [rect(3, 5, 18, 14, 2.5), 'M3.8 6.8L12 13l8.2-6.2'] },
  password: { paths: [rect(5, 11, 14, 10, 2), 'M8 11V8a4 4 0 0 1 8 0v3'] },
  apagar: { paths: ['M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6M14 11v6'] },
} satisfies Record<string, Glyph>;

export type IconName = keyof typeof glyphs;

/** Icon names, kept as `icons.x` so call sites read the same as before. */
export const icons = Object.fromEntries(Object.keys(glyphs).map((name) => [name, name])) as {
  readonly [K in IconName]: K;
};

type IconProps = {
  name: IconName;
  size?: number;
  color?: ColorValue;
  /** Thicker strokes read better at small sizes (e.g. a 13 px check inside a label). */
  strokeWidth?: number;
};

export function Icon({ name, size = 20, color, strokeWidth = 2 }: IconProps) {
  const theme = useTheme();
  const glyph: Glyph = glyphs[name];
  const ink = color ?? theme.text;

  return (
    // Icons never speak: the button or text next to them carries the meaning.
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={glyph.filled ? ink : 'none'}
      stroke={glyph.filled ? 'none' : ink}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      {glyph.paths.map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}

export type IconTone = 'green' | 'yellow' | 'sky' | 'neutral' | 'red';

/** Os tons do azulejo, lidos da paleta em uso — de dia e de noite. */
function tomDoAzulejo(paleta: Paleta, tone: IconTone) {
  switch (tone) {
    case 'yellow':
      return { background: paleta.highlight, ink: paleta.highlightText };
    case 'sky':
      return { background: paleta.infoBackground, ink: paleta.infoText };
    case 'neutral':
      return { background: paleta.backgroundSelected, ink: paleta.text };
    case 'red':
      return { background: paleta.dangerBackground, ink: paleta.dangerText };
    default:
      return { background: paleta.successBackground, ink: paleta.accentInk };
  }
}

/** Icon on a rounded tile. The name is kept from when it was a circle. */
export function IconCircle({
  name,
  size = 18,
  tone = 'green',
}: {
  name: IconName;
  size?: number;
  tone?: IconTone;
}) {
  const theme = useTheme();
  const side = size * 2.3;
  const colors = tomDoAzulejo(theme, tone);

  return (
    <View
      style={[
        styles.tile,
        { width: side, height: side, borderRadius: side * 0.3, backgroundColor: colors.background },
      ]}>
      <Icon name={name} size={size} color={colors.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
});
