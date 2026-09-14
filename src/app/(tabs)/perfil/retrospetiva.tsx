import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { RecapStatsGrid } from '@/features/recap/components/RecapStatsGrid';
import { useLatestRecap, useMarkRecapShared } from '@/features/recap/hooks/useLatestRecap';
import { seasonLabel, shareMessage } from '@/features/recap/stats';
import type { SeasonRecap } from '@/features/recap/types';
import { useTheme } from '@/hooks/use-theme';
import { formatarNumero } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { Button } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

/** Mowing stripes: 36 px wide, every 72 px. */
const STRIPES = Array.from({ length: 16 }, (_, index) => index * 72 + 36);

/** Green header: season, headline, games in big stencil and the summary sentence. */
function CabecalhoEpoca({ dados }: { dados: SeasonRecap }) {
  const jogos = dados.stats.games;
  const rotuloJogos = jogos === 1 ? 'jogo' : 'jogos';

  return (
    <View style={styles.relvado}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {STRIPES.map((left) => (
          <View key={left} style={[styles.risca, { left }]} />
        ))}
      </View>
      <View style={styles.grandeArea} pointerEvents="none">
        <Svg width={510} height={300} viewBox="0 0 510 300" fill="none" stroke={Colors.accentText} strokeWidth={3}>
          <Rect x={80} y={40} width={350} height={300} />
          <Rect x={170} y={40} width={170} height={90} />
          <Path d="M195 130a60 60 0 0 0 120 0" />
        </Svg>
      </View>

      <View style={styles.titulos}>
        <ThemedText type="eyebrow" style={{ color: Colors.highlight }}>
          {`Época ${seasonLabel(dados.seasonId)}`}
        </ThemedText>
        <ThemedText type="title" style={styles.titulo} accessibilityRole="header">
          {dados.headline}
        </ThemedText>
      </View>
      <View style={styles.jogos} accessible accessibilityLabel={`${formatarNumero(jogos)} ${rotuloJogos}`}>
        <ThemedText type="score" style={styles.jogosNumero}>
          {formatarNumero(jogos)}
        </ThemedText>
        <ThemedText type="title" style={styles.jogosRotulo}>
          {rotuloJogos}
        </ThemedText>
      </View>
      <ThemedText style={styles.resumo}>{dados.body}</ThemedText>
    </View>
  );
}

export default function RetrospetivaScreen() {
  const theme = useTheme();
  const userId = useUserId();
  const retrospetiva = useLatestRecap(userId);
  const marcarPartilhada = useMarkRecapShared(userId);

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Precisas de conta"
          message="A retrospetiva da época é feita a partir do que guardas na tua conta."
        />
      </Screen>
    );
  }

  if (retrospetiva.isPending) {
    return (
      <Screen>
        <SkeletonCard lines={4} />
      </Screen>
    );
  }

  if (retrospetiva.isError) {
    return (
      <Screen>
        <EmptyState
          icon={icons.aviso}
          title="Não deu para carregar"
          message="Verifica a ligação e tenta outra vez."
          action={{ label: 'Tentar outra vez', onPress: () => void retrospetiva.refetch() }}
        />
      </Screen>
    );
  }

  const dados = retrospetiva.data;
  if (!dados) {
    return (
      <Screen>
        <EmptyState
          icon={icons.calendario}
          title="A retrospetiva chega em junho"
          message="No fim da época juntamos os teus jogos, estádios novos e tascos num resumo para guardar e partilhar."
        />
      </Screen>
    );
  }

  async function partilhar() {
    if (!dados) return;
    try {
      const resultado = await Share.share({ message: shareMessage(dados) });
      if (resultado.action === Share.sharedAction) marcarPartilhada.mutate(dados.id);
    } catch {
      Alert.alert('Não deu para partilhar', 'Tenta outra vez daqui a nada.');
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.ecra}>
      <CabecalhoEpoca dados={dados} />
      <View style={styles.conteudo}>
        <RecapStatsGrid stats={dados.stats} />
        <View style={styles.partilhar}>
          <Button
            label="Partilhar"
            variant="highlight"
            icon={icons.partilhar}
            onPress={() => void partilhar()}
          />
        </View>
        <ThemedText themeColor="textMuted" style={styles.nota}>
          Os números são contados a partir do que registaste na app. Os quilómetros são em linha reta, ida e volta,
          desde o estádio do teu clube da terra.
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecra: {
    paddingBottom: Spacing.six,
  },
  relvado: {
    overflow: 'hidden',
    gap: 18,
    paddingHorizontal: 22,
    paddingTop: Spacing.four,
    paddingBottom: 34,
    backgroundColor: Colors.accent,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
  },
  risca: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.075)',
  },
  grandeArea: {
    position: 'absolute',
    left: -60,
    bottom: -120,
    opacity: 0.18,
  },
  titulos: {
    gap: Spacing.two,
  },
  titulo: {
    fontSize: 50,
    lineHeight: 54,
    color: Colors.accentText,
  },
  jogos: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  jogosNumero: {
    fontSize: 128,
    lineHeight: 134,
    color: Colors.highlight,
  },
  jogosRotulo: {
    fontSize: 38,
    lineHeight: 42,
    paddingBottom: 18,
    color: Colors.accentText,
  },
  resumo: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.92)',
  },
  conteudo: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: 12,
    paddingTop: 22,
    paddingHorizontal: Spacing.three,
  },
  partilhar: {
    marginTop: Spacing.two,
  },
  nota: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingTop: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
});
