import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

/** Mowing stripes: 36 px wide, every 72 px. Enough to cover the widest content. */
const STRIPES = Array.from({ length: 24 }, (_, index) => index * 72 + 36);

type CabecalhoRelvadoProps = {
  title: string;
  /** Small line above the title (e.g. today's date). White: small yellow text on the green fails contrast. */
  eyebrow?: string;
  /** Content under the title, such as the coach tip card. */
  children?: ReactNode;
};

/**
 * Screen header on a mowed pitch, with the centre circle drawn in chalk.
 *
 * Only the part of the status bar the header actually sits under is added on top: on iOS the tab screens' scroll view
 * may already start below the status bar, and adding the full inset again left an empty green band above the title.
 */
export function CabecalhoRelvado({ title, eyebrow, children }: CabecalhoRelvadoProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<View>(null);
  /** Where the header starts on screen, measured before the first paint. */
  const [topoNoEcra, setTopoNoEcra] = useState(0);

  useLayoutEffect(() => {
    ref.current?.measureInWindow((_x, y) => {
      if (Number.isFinite(y)) setTopoNoEcra(Math.max(0, y));
    });
  }, []);

  const debaixoDaBarra = Math.max(0, insets.top - topoNoEcra);

  return (
    <View
      ref={ref}
      style={[
        styles.relvado,
        { backgroundColor: theme.accent, paddingTop: debaixoDaBarra + Spacing.three },
      ]}>
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {STRIPES.map((left) => (
          <View key={left} style={[styles.risca, { left }]} />
        ))}
      </View>
      <Svg
        width={232}
        height={232}
        viewBox="0 0 232 232"
        fill="none"
        stroke={theme.accentText}
        strokeWidth={3}
        style={styles.circuloCentral}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Circle cx={116} cy={116} r={66} />
        <Path d="M116 0V232" />
        <Circle cx={116} cy={116} r={5} fill={theme.accentText} />
      </Svg>

      <View style={styles.titulos} accessibilityRole="header">
        {eyebrow ? (
          <ThemedText type="eyebrow" style={{ color: theme.accentText }}>
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText type="title" style={[styles.titulo, { color: theme.accentText }]}>
          {title}
        </ThemedText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  relvado: {
    overflow: 'hidden',
    gap: 18,
    paddingHorizontal: 20,
    paddingBottom: 22,

    borderBottomLeftRadius: Radius.header,
    borderBottomRightRadius: Radius.header,
  },
  risca: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.075)',
  },
  circuloCentral: {
    position: 'absolute',
    right: -88,
    top: 4,
    opacity: 0.2,
  },
  titulos: {
    gap: Spacing.one,
  },
  titulo: {
    fontSize: 58,
    lineHeight: 60,
  },
});
