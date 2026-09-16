import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { fontFamily, Fonts, type FontRole, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextType =
  | 'default'
  | 'small'
  | 'smallBold'
  /** Screen title, scoreboard letters. */
  | 'title'
  | 'subtitle'
  /** Section heading ("Como chegar"). */
  | 'section'
  /** Stencil numbers: kick-off times, counts, scores. */
  | 'score'
  /** Small spaced capitals above a title ("Dia de jogo"). */
  | 'eyebrow'
  | 'link'
  | 'linkPrimary'
  | 'code';

export type ThemedTextProps = TextProps & {
  type?: TextType;
  themeColor?: ThemeColor;
};

const roles: Partial<Record<TextType, FontRole>> = {
  title: 'display',
  subtitle: 'display',
  section: 'display',
  score: 'stencil',
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const flat: TextStyle = StyleSheet.flatten([{ color: theme[themeColor ?? 'text'] }, styles[type], style]);
  // Each weight is a separate font file: pick it from the weight and drop `fontWeight`, so Android
  // does not fake a bold on top. An explicit `fontFamily` (e.g. monospace) is left alone.
  const font = flat.fontFamily
    ? null
    : { fontFamily: fontFamily(roles[type] ?? 'body', flat.fontWeight), fontWeight: 'normal' as const };

  return <Text style={[flat, font]} {...rest} />;
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  title: {
    fontSize: 48,
    lineHeight: 52,
    fontWeight: 900,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: 800,
  },
  section: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: 800,
  },
  score: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: 800,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 800,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
    fontWeight: 700,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    fontWeight: 700,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
