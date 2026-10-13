import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';

import type { FundoConversa as Fundo, FundoPronto } from '@/features/groups/api';
import { useTheme } from '@/hooks/use-theme';
import { useCoresDaConversa } from '@/ui/conversa';

/** O nome de cada fundo, como aparece na escolha. */
export const NOMES_DOS_FUNDOS: Record<FundoPronto, string> = {
  relvado: 'Relvado',
  bancada: 'Bancada',
  noite: 'Jogo à noite',
  cachecol: 'Cachecol',
  liso: 'Liso',
};

/** Os fundos que são escuros de dia e de noite: por cima deles, a hora e os avisos precisam de uma pastilha clara. */
export function fundoEscuro(fundo: Fundo) {
  return fundo.kind === 'foto' || fundo.fundo === 'noite';
}

/**
 * O fundo da conversa de um grupo. Desenhado com traços leves, para as mensagens se lerem por cima; uma foto leva
 * um véu escuro pelo mesmo motivo.
 */
export function FundoConversa({ fundo }: { fundo: Fundo }) {
  const { fundo: papel } = useCoresDaConversa();

  if (fundo.kind === 'foto') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {fundo.url ? (
          <Image
            source={{ uri: fundo.url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, styles.veu]} />
      </View>
    );
  }

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: papel }]}
      pointerEvents="none">
      <Svg width="100%" height="100%">
        <Desenho fundo={fundo.fundo} />
      </Svg>
    </View>
  );
}

/** Uma miniatura do fundo, para a escolha nas definições do grupo. */
export function AmostraDeFundo({ fundo, size = 64 }: { fundo: FundoPronto; size?: number }) {
  const { fundo: papel } = useCoresDaConversa();
  return (
    <View
      style={[
        styles.amostra,
        { width: size, height: size * 1.4, backgroundColor: papel },
      ]}>
      <Svg width="100%" height="100%">
        <Desenho fundo={fundo} />
      </Svg>
    </View>
  );
}

function Desenho({ fundo }: { fundo: FundoPronto }) {
  const theme = useTheme();

  switch (fundo) {
    case 'relvado':
      // As riscas do corte da relva, como no cabeçalho dos jogos, mas quase apagadas.
      return (
        <>
          <Defs>
            <Pattern id="relvado" width="56" height="56" patternUnits="userSpaceOnUse">
              <Rect width="56" height="28" fill={theme.successBackground} opacity={0.55} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#relvado)" />
        </>
      );
    case 'bancada':
      // Filas de cadeiras vistas de frente.
      return (
        <>
          <Defs>
            <Pattern id="bancada" width="22" height="18" patternUnits="userSpaceOnUse">
              <Path
                d="M4 12V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5"
                stroke={theme.borderStrong}
                strokeWidth={1.4}
                fill="none"
                strokeLinecap="round"
              />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#bancada)" opacity={0.7} />
        </>
      );
    case 'noite':
      // Céu de jogo à noite, com os projetores lá em cima.
      return (
        <>
          <Defs>
            <LinearGradient id="noite" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0B1A2E" />
              <Stop offset="0.7" stopColor="#10261C" />
              <Stop offset="1" stopColor="#0E2E1C" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#noite)" />
          {[12, 30, 70, 88].map((x) => (
            <Circle key={x} cx={`${x}%`} cy="5%" r="3" fill="#FFF6D6" opacity={0.85} />
          ))}
          {[12, 30, 70, 88].map((x) => (
            <Circle key={`halo-${x}`} cx={`${x}%`} cy="5%" r="16" fill="#FFF6D6" opacity={0.08} />
          ))}
        </>
      );
    case 'cachecol':
      // Riscas diagonais de cachecol, em amarelo de cartão e verde.
      return (
        <>
          <Defs>
            <Pattern
              id="cachecol"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-30)">
              <Rect width="12" height="48" fill={theme.highlight} opacity={0.18} />
              <Rect x="24" width="12" height="48" fill={theme.accent} opacity={0.1} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#cachecol)" />
        </>
      );
    case 'liso':
      return <Rect width="100%" height="100%" fill={theme.backgroundSelected} opacity={0.5} />;
  }
}

const styles = StyleSheet.create({
  veu: {
    backgroundColor: 'rgba(8, 14, 11, 0.45)',
  },
  amostra: {
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
});
