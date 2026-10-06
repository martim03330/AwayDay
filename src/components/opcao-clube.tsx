import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CardShadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Clube } from '@/mocks/tipos';
import { Escudo } from '@/ui/escudo';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type OpcaoClubeProps = {
  clube: Clube;
  /** A line under the name; nothing when there is nothing true to say. */
  detalhe?: string | null;
  selecionado: boolean;
  onPress: () => void;
};

const SCARF_WIDTH = 18;
/** Tall enough for any row; the row clips what is left over. */
const SCARF_HEIGHT = 240;
/** 8 px bands at 135deg, like `repeating-linear-gradient(135deg, a 0 8px, b 8px 16px)`. */
const BAND = 8 * Math.SQRT2;

const scarfBands = (() => {
  let d = '';
  for (let start = 0; start < SCARF_HEIGHT + SCARF_WIDTH; start += BAND * 2) {
    const end = start + BAND;
    d += `M${start} 0H${end}L${end - SCARF_HEIGHT} ${SCARF_HEIGHT}H${start - SCARF_HEIGHT}z`;
  }
  return d;
})();

/** Scarf stripe in the club colours, down the left edge of the row. */
function Cachecol({ clube }: { clube: Clube }) {
  return (
    <View
      style={[styles.cachecol, { backgroundColor: clube.cores.secundaria }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width={SCARF_WIDTH} height={SCARF_HEIGHT} viewBox={`0 0 ${SCARF_WIDTH} ${SCARF_HEIGHT}`}>
        <Path d={scarfBands} fill={clube.cores.primaria} />
      </Svg>
    </View>
  );
}

/** Linha de escolha de clube (botão de rádio) para os seletores do perfil. */
export function OpcaoClube({ clube, detalhe, selecionado, onPress }: OpcaoClubeProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selecionado }}
      accessibilityLabel={detalhe ? `${clube.nomeCurto}, ${detalhe}` : clube.nomeCurto}
      onPress={onPress}
      style={({ pressed }) => [
        styles.linha,
        { backgroundColor: theme.backgroundElement },
        selecionado && { boxShadow: `0 0 0 2px ${theme.accentInk}` },
        pressed && styles.pressed,
      ]}>
      {/* The shadow lives on the Pressable; this inner frame clips the scarf to the rounded corners. */}
      <View style={styles.moldura}>
        <Cachecol clube={clube} />
        <View style={styles.conteudo}>
          <Escudo clube={clube} size={36} />
          <View style={styles.flex}>
            <ThemedText type="section" style={styles.nome} numberOfLines={1}>
              {clube.nomeCurto}
            </ThemedText>
            {detalhe ? (
              <ThemedText style={styles.detalhe} themeColor="textSecondary" numberOfLines={1}>
                {detalhe}
              </ThemedText>
            ) : null}
          </View>
          {selecionado ? (
            <View style={[styles.visto, { backgroundColor: theme.accent }]}>
              <Icon name={icons.checkInFeito} size={16} strokeWidth={3} color={theme.accentText} />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  linha: {
    borderRadius: 18,
    borderCurve: 'continuous',
    ...CardShadow,
  },
  moldura: {
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  cachecol: {
    width: SCARF_WIDTH,
    overflow: 'hidden',
  },
  conteudo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  pressed: {
    opacity: 0.7,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  nome: {
    fontSize: 22,
    lineHeight: 25,
  },
  detalhe: {
    fontSize: 13,
    lineHeight: 18,
  },
  visto: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
