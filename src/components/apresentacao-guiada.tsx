import { useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { vibrarLeve } from '@/lib/vibrar';
import { Button } from '@/ui/button';
import { ThemedText } from '@/ui/themed-text';

type Passo = { titulo: string; texto: string };

/** One step per tab, in the order of the tab bar. Short on purpose: Martim corrects the words. */
const PASSOS: readonly Passo[] = [
  {
    titulo: 'Jogos',
    texto: 'Os jogos do teu clube. Marca «Vou», vê como chegar, onde estacionar e as boleias para o jogo.',
  },
  {
    titulo: 'Malta',
    texto: 'Os teus grupos. Combina os jogos, conversa e a app faz as contas das despesas da viagem.',
  },
  {
    titulo: 'Locais',
    texto: 'Os tascos à volta do estádio que os adeptos recomendam. Faz check-in e ajuda a malta.',
  },
  {
    titulo: 'Ranking',
    texto: 'Ganha pontos com estádios, tascos e missões, e sobe na tabela.',
  },
  {
    titulo: 'Perfil',
    texto: 'O teu passaporte de estádios, os amigos e as definições. Bora à bola!',
  },
];

/** Where the native tab bar is, to light up one tab. iOS 26 floats it; before, and on Android, it fills the bottom. */
function barraDosSeparadores(largura: number, fundo: number) {
  const ios = Platform.OS === 'ios';
  const flutuante = ios && Number.parseFloat(String(Platform.Version)) >= 26;
  if (flutuante) {
    // Measured on an iPhone 17 Pro: the floating bar's tabs sit 26 pt in from each side of the screen.
    const margem = 26;
    return {
      esquerda: margem,
      largura: largura - margem * 2,
      altura: 62,
      baixo: Math.max(fundo - 12, 8),
      // Its 5 tabs are not evenly spread (iOS gives longer names a little more room): where each one's centre sits,
      // as a share of the bar, measured on an iPhone 17 Pro with Jogos, Malta, Locais, Ranking and Perfil.
      centros: [0.1046, 0.3091, 0.5129, 0.7049, 0.8997] as readonly number[],
    };
  }
  return { esquerda: 0, largura, altura: ios ? 49 : 80, baixo: ios ? fundo : 0, centros: null };
}

/** A dim layer with a rounded hole around the highlighted tab (even-odd fill: the hole is left out). */
function Escurecer({
  largura,
  altura,
  buraco,
}: {
  largura: number;
  altura: number;
  buraco: { x: number; y: number; l: number; a: number; r: number };
}) {
  const { x, y, l, a, r } = buraco;
  const recorte =
    `M${x + r} ${y}h${l - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${a - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}` +
    `h${-(l - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(a - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
  return (
    <Svg width={largura} height={altura} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={`M0 0H${largura}V${altura}H0Z ${recorte}`} fill="rgba(10, 20, 14, 0.62)" fillRule="evenodd" />
    </Svg>
  );
}

/**
 * The tour of the app, on top of the real tabs (testers asked for «caixinhas»): the screen dims, the tab being
 * explained is lit up, and a box above it says what is there, with an arrow pointing at it. Once after the
 * introduction, and again from Settings.
 */
export function ApresentacaoGuiada({ onFim }: { onFim: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [indice, setIndice] = useState(0);
  const passo = PASSOS[indice];
  const ultimo = indice === PASSOS.length - 1;

  const barra = barraDosSeparadores(width, insets.bottom);
  const larguraSeparador = barra.largura / PASSOS.length;
  const fracao =
    barra.centros && barra.centros.length === PASSOS.length ? barra.centros[indice] : (indice + 0.5) / PASSOS.length;
  const centro = barra.esquerda + barra.largura * (fracao ?? (indice + 0.5) / PASSOS.length);
  const topoDaBarra = height - barra.baixo - barra.altura;
  const buraco = {
    x: centro - larguraSeparador / 2 + 2,
    y: topoDaBarra + 2,
    l: larguraSeparador - 4,
    a: barra.altura - 4,
    r: Math.min(26, (barra.altura - 4) / 2),
  };

  // The arrow under the box slides to the tab being explained.
  const seta = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(centro - Spacing.three - 9, { duration: 220 }) }],
  }));

  function seguinte() {
    vibrarLeve();
    if (ultimo) onFim();
    else setIndice((atual) => atual + 1);
  }

  if (!passo) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(160)}
      style={StyleSheet.absoluteFill}
      accessibilityViewIsModal>
      <Escurecer largura={width} altura={height} buraco={buraco} />

      <Pressable
        onPress={onFim}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Saltar a apresentação"
        style={[styles.saltar, { top: insets.top + Spacing.two }]}>
        <ThemedText style={styles.saltarTexto}>Saltar</ThemedText>
      </Pressable>

      <View style={[styles.caixaLugar, { bottom: barra.baixo + barra.altura + 14 }]}>
        <View
          style={[styles.caixa, CardShadow, { backgroundColor: theme.backgroundElement }]}
          accessible
          accessibilityLabel={`${passo.titulo}. ${passo.texto}. Passo ${indice + 1} de ${PASSOS.length}.`}>
          <ThemedText type="eyebrow" themeColor="accentInk">
            {`${indice + 1} de ${PASSOS.length}`}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.titulo}>
            {passo.titulo}
          </ThemedText>
          <ThemedText themeColor="textSecondary">{passo.texto}</ThemedText>
          <View style={styles.rodape}>
            <View style={styles.pontos}>
              {PASSOS.map((outro, i) => (
                <View
                  key={outro.titulo}
                  style={[
                    styles.ponto,
                    { backgroundColor: i === indice ? theme.accent : theme.backgroundSelected },
                    i === indice && styles.pontoAtivo,
                  ]}
                />
              ))}
            </View>
            <View style={styles.botao}>
              <Button label={ultimo ? 'Começar' : 'Seguinte'} variant="highlight" onPress={seguinte} />
            </View>
          </View>
        </View>
        <Animated.View style={[styles.seta, { borderTopColor: theme.backgroundElement }, seta]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  saltar: {
    position: 'absolute',
    right: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  saltarTexto: {
    color: '#FFFFFF',
    fontWeight: 700,
  },
  caixaLugar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
  },
  caixa: {
    gap: Spacing.one,
    padding: Spacing.four,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  titulo: {
    fontSize: 28,
    lineHeight: 32,
  },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  pontos: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  ponto: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pontoAtivo: {
    width: 18,
  },
  botao: {
    minWidth: 130,
  },
  seta: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
