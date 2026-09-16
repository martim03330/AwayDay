/**
 * "Relvado" palette: pitch green, whitewash background, yellow-card highlights and dark green ink
 * instead of black. Light only for now (see docs/DECISOES.md, 2026-09-14).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  /** Ink: body text. */
  text: '#13241B',
  textSecondary: '#56675D',
  /** Placeholders, counters, disabled labels. */
  textMuted: '#8A968F',

  /** Whitewash: app background. */
  background: '#F8F7F2',
  /** Paper: cards and inputs. */
  backgroundElement: '#FFFFFF',
  /** Darker whitewash: neutral fills, tracks, skeletons. */
  backgroundSelected: '#EFEDE4',
  border: '#E2DFD3',
  /** Dashed outlines (empty states). */
  borderStrong: '#D6D2C4',

  /** Pitch green: primary action, screen headers. */
  accent: '#1C8A4D',
  accentPressed: '#0E5530',
  accentText: '#FFFFFF',
  /** Green text on light backgrounds (eyebrows, links, selected labels). */
  accentInk: '#16713F',

  /** Yellow card: highlights and actions on top of green. */
  highlight: '#FFCE3A',
  highlightText: '#13241B',

  success: '#16713F',
  successText: '#0E5530',
  successBackground: '#DDF2E3',
  warning: '#7A5600',
  warningText: '#5A4300',
  warningBackground: '#FFF3C7',
  /** Red card: errors, destructive actions, live. */
  danger: '#D9432F',
  dangerText: '#A12A18',
  dangerBackground: '#FBE2DD',
  /** Sky: transport, weather, informative notes. */
  info: '#2F7BEA',
  infoText: '#1F5BB5',
  infoBackground: '#DCEAFD',

  shadow: '#13241B',
} as const;

export type ThemeColor = keyof typeof Colors;

type FontWeight = 400 | 500 | 600 | 700 | 800 | 900;

/**
 * Loaded font files per weight. Custom fonts ignore `fontWeight` on Android (and iOS cannot match
 * weights across these family names), so every weight is its own family.
 */
export const FontFiles = {
  /** Figtree: body text. */
  body: {
    400: 'Figtree_400Regular',
    500: 'Figtree_500Medium',
    600: 'Figtree_600SemiBold',
    700: 'Figtree_700Bold',
    800: 'Figtree_800ExtraBold',
  },
  /** Big Shoulders: screen titles and section headings. */
  display: {
    700: 'BigShoulders_700Bold',
    800: 'BigShoulders_800ExtraBold',
    900: 'BigShoulders_900Black',
  },
  /** Big Shoulders Stencil: kick-off times, counts and scores. */
  stencil: {
    800: 'BigShouldersStencil_800ExtraBold',
  },
} as const satisfies Record<string, Partial<Record<FontWeight, string>>>;

export type FontRole = keyof typeof FontFiles;

/** Font family for a role and weight, falling back to the closest weight that is loaded. */
export function fontFamily(role: FontRole, weight: number | string | undefined): string {
  const files: Partial<Record<number, string>> = FontFiles[role];
  const wanted = parseWeight(weight);
  const available = Object.keys(files).map(Number);
  const closest = available.reduce((best, current) =>
    Math.abs(current - wanted) < Math.abs(best - wanted) ? current : best
  );
  return files[closest] ?? FontFiles.body[500];
}

function parseWeight(weight: number | string | undefined): number {
  if (weight === undefined || weight === 'normal') return 400;
  if (weight === 'bold') return 700;
  const parsed = Number(weight);
  return Number.isFinite(parsed) ? parsed : 400;
}

export const Fonts = Platform.select({
  ios: { mono: 'ui-monospace' },
  web: { mono: 'var(--font-mono)' },
  default: { mono: 'monospace' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  /** 12: ar entre linhas dentro de um cartão — texto, etiquetas e botões deixam de se tocar. */
  twoAndHalf: 12,
  three: 16,
  /** 20: ar entre blocos de um ecrã e dentro dos cartões. */
  threeAndHalf: 20,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  field: 12,
  button: 16,
  card: 20,
  header: 30,
  pill: 999,
} as const;

/** Soft paper shadow for cards. */
export const CardShadow = {
  boxShadow: '0 1px 0 rgba(19, 36, 27, 0.05), 0 8px 24px rgba(19, 36, 27, 0.06)',
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
