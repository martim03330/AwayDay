import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarDia, formatarDiaEHora, formatarHora } from '@/lib/datas';
import { formatarNota } from '@/lib/formatos';
import { eCompeticaoEuropeia, faseCurta, fimDoJogo, notaMedia, type EstadoJogo } from '@/lib/jogos';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { nomesCompeticao } from '@/mocks/jogos';
import type { AvaliacaoVisita, Clube, Jogo } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Escudo } from '@/ui/escudo';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type JogoCardProps = {
  jogo: Jogo;
  estado: EstadoJogo;
  avaliacao: AvaliacaoVisita | undefined;
  onPress: () => void;
};

const rotulosEstado: Record<EstadoJogo, string | null> = {
  agendado: null,
  'a-decorrer': 'Em jogo',
  terminado: 'Terminado',
};

/** Width of the ticket stub on the right. */
const LARGURA_CANHOTO = 94;
/** Diameter of the two half-circles punched out at the top and bottom of the perforation. */
const FURO = 20;

/** Yellow dot with a halo that pulses while a game is on. Static when reduced motion is on. */
export function PontoAoVivo() {
  const theme = useTheme();
  const reduzirMovimento = useReducedMotion();
  const pulso = useSharedValue(0);

  useEffect(() => {
    if (reduzirMovimento) {
      cancelAnimation(pulso);
      pulso.set(0);
      return;
    }
    pulso.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1));
    return () => cancelAnimation(pulso);
  }, [pulso, reduzirMovimento]);

  const halo = useAnimatedStyle(() =>
    reduzirMovimento
      ? { opacity: 0.3, transform: [{ scale: 2 }] }
      : { opacity: 0.6 * (1 - pulso.get()), transform: [{ scale: 1 + pulso.get() * 1.4 }] }
  );

  return (
    <View style={styles.ponto}>
      <Animated.View style={[styles.pontoCirculo, { backgroundColor: theme.highlight }, halo]} />
      <View style={[styles.pontoCirculo, { backgroundColor: theme.highlight }]} />
    </View>
  );
}

function LinhaEquipa({ clube }: { clube: Clube }) {
  return (
    <View style={styles.equipa}>
      <Escudo clube={clube} size={30} />
      <ThemedText style={styles.equipaNome} numberOfLines={1}>
        {clube.nomeCurto}
      </ThemedText>
    </View>
  );
}

/** A fixture as a perforated match ticket: teams on the left, kick-off (or state) on the stub. */
export function JogoCard({ jogo, estado, avaliacao, onPress }: JogoCardProps) {
  const theme = useTheme();
  const casa = obterClube(jogo.casaId);
  const fora = obterClube(jogo.foraId);
  const estadio = obterEstadio(jogo.estadioId);
  if (!casa || !fora) return null;

  const inicio = new Date(jogo.inicio);
  const rotuloEstado = rotulosEstado[estado];
  const media = avaliacao ? formatarNota(notaMedia(avaliacao)) : null;
  const aDecorrer = estado === 'a-decorrer';

  function renderCanhoto() {
    if (aDecorrer) {
      return (
        <>
          <PontoAoVivo />
          <ThemedText type="eyebrow" themeColor="accentText">
            Em jogo
          </ThemedText>
          <ThemedText style={[styles.ate, { color: theme.accentText }]}>
            {`até ${formatarHora(fimDoJogo(jogo))}`}
          </ThemedText>
        </>
      );
    }

    if (estado === 'terminado') {
      return (
        <>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            Terminado
          </ThemedText>
          {media ? (
            <View style={[styles.nota, { backgroundColor: theme.warningBackground }]}>
              <Icon name={icons.estrela} size={13} color={theme.warning} />
              <ThemedText style={[styles.notaTexto, { color: theme.warning }]}>{media}</ThemedText>
            </View>
          ) : null}
        </>
      );
    }

    return (
      <>
        <ThemedText type="score" style={styles.hora}>
          {jogo.horaConfirmada ? formatarHora(inicio) : '--:--'}
        </ThemedText>
        <ThemedText type="eyebrow" themeColor="accentInk">
          {jogo.horaConfirmada ? 'Apito' : 'Por definir'}
        </ThemedText>
      </>
    );
  }

  return (
    <Card
      onPress={onPress}
      style={styles.card}
      accessibilityLabel={[
        `${casa.nomeCurto} contra ${fora.nomeCurto}`,
        jogo.horaConfirmada ? formatarDiaEHora(inicio) : `${formatarDia(inicio)}, hora por definir`,
        nomesCompeticao[jogo.competicao],
        rotuloEstado,
        media ? `avaliado com ${media} de 5` : null,
      ]
        .filter(Boolean)
        .join(', ')}>
      <View style={styles.corpo}>
        <ThemedText
          type="eyebrow"
          themeColor={eCompeticaoEuropeia(jogo.competicao) ? 'info' : 'textSecondary'}
          numberOfLines={1}>
          {nomesCompeticao[jogo.competicao]} · {faseCurta(jogo.fase)}
        </ThemedText>

        <View style={styles.equipas}>
          <LinhaEquipa clube={casa} />
          <LinhaEquipa clube={fora} />
        </View>

        {estadio ? (
          <View style={styles.estadio}>
            <Icon name={icons.locais} size={15} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.estadioNome} numberOfLines={1}>
              {estadio.nome}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.canhoto,
          { borderLeftColor: theme.border },
          aDecorrer && { backgroundColor: theme.accent, borderLeftColor: theme.accentText },
          estado === 'terminado' && styles.canhotoTerminado,
        ]}>
        {renderCanhoto()}
      </View>

      {/* The two punched holes of the perforation, painted in the screen background. Clipped to the card: the half
          outside sat on the card's shadow in light mode and read as a ball. */}
      <View style={styles.furos} pointerEvents="none">
        <View style={[styles.furo, styles.furoTopo, { backgroundColor: theme.background }]} />
        <View style={[styles.furo, styles.furoBase, { backgroundColor: theme.background }]} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
    padding: 0,
  },
  corpo: {
    flex: 1,
    minWidth: 0,
    gap: 11,
    paddingVertical: 14,
    paddingLeft: Spacing.three,
    paddingRight: 14,
  },
  equipas: {
    gap: Spacing.two,
  },
  equipa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  equipaNome: {
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 700,
  },
  estadio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  estadioNome: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 600,
  },
  canhoto: {
    width: LARGURA_CANHOTO,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    borderTopRightRadius: Radius.card,
    borderBottomRightRadius: Radius.card,
    borderCurve: 'continuous',
  },
  canhotoTerminado: {
    gap: 10,
  },
  hora: {
    fontSize: 34,
    lineHeight: 38,
    fontVariant: ['tabular-nums'],
  },
  ate: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
    opacity: 0.85,
  },
  nota: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: Radius.pill,
  },
  notaTexto: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 800,
  },
  furos: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  furo: {
    position: 'absolute',
    // Centred on the 2 px dashed perforation.
    right: LARGURA_CANHOTO - FURO / 2 - 1,
    width: FURO,
    height: FURO,
    borderRadius: FURO / 2,
  },
  furoTopo: {
    top: -FURO / 2,
  },
  furoBase: {
    bottom: -FURO / 2,
  },
  ponto: {
    width: 10,
    height: 10,
    marginBottom: Spacing.one,
  },
  pontoCirculo: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
