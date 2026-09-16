import { StyleSheet, Switch, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { avisosDoJogo, horasDoPlano } from '@/lib/avisos-jogo';
import { formatarDiaEHora, formatarHora } from '@/lib/datas';
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
}: {
  rotulo: string;
  hora: string;
  destaque?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${rotulo}: ${hora}`}
      style={[styles.linhaHora, { borderTopColor: theme.backgroundSelected }]}>
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

  return (
    <>
      <SectionHeader title="As tuas horas" />
      <Card style={styles.cartao}>
        {jogo.horaConfirmada ? (
          <>
            <LinhaHora
              rotulo={onde ? `Sair do ${onde.nome} para o estádio` : 'Ir para o estádio'}
              hora={formatarHora(horas.sairParaOEstadio)}
              destaque
            />
            <LinhaHora rotulo="Apito inicial" hora={formatarHora(inicio)} />
            <ThemedText type="small" themeColor="textMuted">
              {onde
                ? `Estás no ${onde.nome}: conta com ${onde.minutosAPe} min a pé, 15 min para entrar e 10 de folga.`
                : 'Conta com 15 min para entrar e 10 de folga. Faz check-in no sítio onde estiveres e acertamos a hora ao caminho a pé.'}
            </ThemedText>
          </>
        ) : (
          <ThemedText themeColor="textSecondary">
            As horas aparecem quando a hora do jogo for confirmada. Avisamos-te quando mudar.
          </ThemedText>
        )}
      </Card>

      <SectionHeader title="Avisos deste jogo" />
      <Card style={styles.cartao}>
        <View style={styles.linha}>
          <ThemedText style={styles.flex}>Avisar-me neste telemóvel</ThemedText>
          <Switch
            value={avisosLigados(jogo.id)}
            onValueChange={() => alternarAvisos(jogo.id)}
            trackColor={{ true: theme.accent, false: theme.border }}
            thumbColor={theme.accentText}
            ios_backgroundColor={theme.border}
            accessibilityLabel="Avisos deste jogo"
          />
        </View>
        {avisos.map((aviso) => (
          <View key={aviso.id} style={[styles.aviso, { borderTopColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">{formatarDiaEHora(aviso.quando, agora)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {aviso.titulo}
            </ThemedText>
          </View>
        ))}
        <ThemedText type="small" themeColor="textMuted">
          O aviso para planear chega 3 dias antes, nunca na véspera. Os do dia acertam-se ao sítio
          onde estiveres.
        </ThemedText>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.two,
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
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },
  hora: {
    fontSize: 26,
    lineHeight: 30,
  },
  aviso: {
    gap: 2,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },
});
