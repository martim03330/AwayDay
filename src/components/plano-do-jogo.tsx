import { StyleSheet, Switch, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { avisosDoJogo, horasDoPlano } from '@/lib/avisos-jogo';
import { formatarDiaCurto, formatarHora } from '@/lib/datas';
import { obterClube } from '@/mocks/clubes';
import { obterLocal } from '@/mocks/locais';
import type { Jogo } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { usePlanosJogos } from '@/state/planos-jogos';
import { Card } from '@/ui/card';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

function LinhaHora({
  rotulo,
  hora,
  destaque = false,
  primeira = false,
}: {
  rotulo: string;
  hora: string;
  destaque?: boolean;
  /** The first row of the card: no hairline above it. */
  primeira?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${rotulo}: ${hora}`}
      style={[
        styles.linhaHora,
        !primeira && { paddingTop: Spacing.two, borderTopWidth: 1 },
        { borderTopColor: theme.backgroundSelected },
      ]}>
      <ThemedText style={styles.flex}>{rotulo}</ThemedText>
      <ThemedText type="score" style={[styles.hora, destaque && { color: theme.accentInk }]}>
        {hora}
      </ThemedText>
    </View>
  );
}

/**
 * O plano de quem vai a este jogo: as horas e os avisos.
 *
 * As horas não pedem para escolher um tasco à frente — um dia de jogo não se resume a um sítio. Enquanto não há
 * check-in, contam até ao estádio; **assim que fazes check-in nalgum sítio, a hora de sair passa a contar a partir
 * daí**, com os minutos a pé desse sítio.
 */
export function PlanoDoJogo({ jogo, agora }: { jogo: Jogo; agora: number }) {
  const theme = useTheme();
  const { localDoCheckIn } = useAppState();
  const { avisosLigados, alternarAvisos } = usePlanosJogos();

  const onde = localDoCheckIn ? (obterLocal(localDoCheckIn) ?? null) : null;
  const horas = horasDoPlano(jogo, onde);
  const inicio = new Date(jogo.inicio);
  const casa = obterClube(jogo.casaId);
  const fora = obterClube(jogo.foraId);
  const avisos =
    casa && fora
      ? avisosDoJogo(jogo, { casa: casa.nomeCurto, fora: fora.nomeCurto }, onde, agora)
      : [];

  // Hours and alerts are one plan: one title, one card.
  return (
    <>
      <SectionHeader title="O teu plano" />
      <Card style={styles.cartao}>
        {jogo.horaConfirmada ? (
          <>
            <LinhaHora
              rotulo={onde ? `Sair do ${onde.nome}` : 'Ir para o estádio'}
              hora={formatarHora(horas.sairParaOEstadio)}
              destaque
              primeira
            />
            <LinhaHora rotulo="Apito inicial" hora={formatarHora(inicio)} />
          </>
        ) : (
          <ThemedText themeColor="textSecondary">
            As horas aparecem quando o jogo tiver hora marcada.
          </ThemedText>
        )}

        <View style={[styles.linha, styles.separado, { borderTopColor: theme.backgroundSelected }]}>
          <ThemedText style={[styles.rotuloAvisos, styles.flex]}>Avisos neste telemóvel</ThemedText>
          <Switch
            value={avisosLigados(jogo.id)}
            onValueChange={() => alternarAvisos(jogo.id)}
            trackColor={{ true: theme.accent, false: theme.border }}
            thumbColor={theme.accentText}
            ios_backgroundColor={theme.border}
            accessibilityLabel="Avisos deste jogo"
          />
        </View>
        {/* Only when on, in two aligned columns: the short date over the time, then what it says. */}
        {avisosLigados(jogo.id)
          ? avisos.map((aviso) => (
              <View key={aviso.id} style={styles.aviso}>
                <View style={styles.quando}>
                  <ThemedText type="smallBold">{formatarDiaCurto(aviso.quando, agora)}</ThemedText>
                  <ThemedText type="small" themeColor="textMuted">
                    {formatarHora(aviso.quando)}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {aviso.titulo}
                </ThemedText>
              </View>
            ))
          : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.twoAndHalf,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  linhaHora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  separado: {
    marginTop: Spacing.one,
    paddingTop: Spacing.twoAndHalf,
    borderTopWidth: 1,
  },
  rotuloAvisos: {
    fontWeight: 700,
  },
  hora: {
    fontSize: 26,
    lineHeight: 30,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  quando: {
    width: 64,
  },
});
