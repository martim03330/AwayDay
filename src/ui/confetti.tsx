import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { DURACAO_MAXIMA_CONFETTI_MS, gerarParticulas, type Particula } from '@/ui/confetti-particulas';

type Lancar = (cores: readonly string[]) => void;

const ConfettiContext = createContext<Lancar | null>(null);

const nenhum: Lancar = () => undefined;

/**
 * Throws a burst of confetti over the whole screen. Outside a `CamadaConfetti` (or with Reduce Motion on) it does
 * nothing, so a celebration is never in the way of the action itself.
 */
export function useConfetti(): Lancar {
  return use(ConfettiContext) ?? nenhum;
}

/**
 * Wraps a screen so anything inside can celebrate over all of it. The confetti never catches a touch and goes away by
 * itself in two seconds.
 */
export function CamadaConfetti({ children }: { children: ReactNode }) {
  const reduzirMovimento = useReducedMotion();
  const [disparo, setDisparo] = useState<{ id: number; particulas: Particula[] } | null>(null);

  function lancar(cores: readonly string[]) {
    if (reduzirMovimento) return;
    setDisparo((atual) => ({ id: (atual?.id ?? 0) + 1, particulas: gerarParticulas(cores) }));
  }

  return (
    <ConfettiContext value={lancar}>
      <View style={styles.ecra}>
        {children}
        {disparo ? (
          <Chuva key={disparo.id} particulas={disparo.particulas} onFim={() => setDisparo(null)} />
        ) : null}
      </View>
    </ConfettiContext>
  );
}

function Chuva({ particulas, onFim }: { particulas: readonly Particula[]; onFim: () => void }) {
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    const temporizador = setTimeout(onFim, DURACAO_MAXIMA_CONFETTI_MS + 100);
    return () => clearTimeout(temporizador);
  }, [onFim]);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {particulas.map((particula) => (
        <Peca key={particula.id} particula={particula} largura={width} altura={height} />
      ))}
    </View>
  );
}

function Peca({ particula, largura, altura }: { particula: Particula; largura: number; altura: number }) {
  const progresso = useSharedValue(0);

  useEffect(() => {
    progresso.set(
      withDelay(
        particula.atrasoMs,
        withTiming(1, { duration: particula.duracaoMs, easing: Easing.in(Easing.quad) })
      )
    );
  }, [particula, progresso]);

  const inicioX = particula.x * largura;
  const estilo = useAnimatedStyle(() => {
    const p = progresso.get();
    return {
      opacity: p === 0 ? 0 : p > 0.85 ? (1 - p) / 0.15 : 1,
      transform: [
        { translateX: inicioX + particula.deriva * p },
        { translateY: -20 + p * (altura + 40) },
        { rotate: `${particula.rotacao * p}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.peca,
        {
          width: particula.largura,
          height: particula.altura,
          backgroundColor: particula.cor,
          borderRadius: particula.forma === 'circulo' ? particula.largura / 2 : 1,
        },
        estilo,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ecra: {
    flex: 1,
  },
  peca: {
    position: 'absolute',
    top: 0,
    left: 0,
    // Keeps white pieces visible on a light screen.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.12)',
  },
});
