import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { avisosDoJogo, horasDoPlano } from '@/lib/avisos-jogo';
import { formatarDiaCurto, formatarHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { obterClube } from '@/mocks/clubes';
import { obterLocal } from '@/mocks/locais';
import type { Jogo } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { usePlanosJogos } from '@/state/planos-jogos';
import { Card } from '@/ui/card';
import { Expansor } from '@/ui/expansor';
import { IconCircle, icons } from '@/ui/icon';
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
  const [verAvisos, setVerAvisos] = useState(false);
  const ligados = avisosLigados(jogo.id);
  const resumoDosAvisos = !ligados
    ? 'Desligados'
    : avisos.length > 0
      ? plural(avisos.length, 'aviso', 'avisos')
      : 'Sem avisos por enviar';

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
          <IconCircle name={icons.notificacoes} />
          <View style={styles.flex}>
            <ThemedText style={styles.rotuloAvisos}>Avisos para este jogo</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {resumoDosAvisos}
            </ThemedText>
          </View>
          <Switch
            value={ligados}
            onValueChange={() => alternarAvisos(jogo.id)}
            trackColor={{ true: theme.accent, false: theme.border }}
            thumbColor={theme.accentText}
            ios_backgroundColor={theme.border}
            accessibilityLabel="Avisos deste jogo"
          />
        </View>
        {ligados && avisos.length > 0 ? (
          <Expansor
            titulo="Ver os avisos"
            contagem={avisos.length}
            aberto={verAvisos}
            onPress={() => setVerAvisos((atual) => !atual)}
          />
        ) : null}
        {/* A small timeline: a dot per alert, joined by a line; what it says, then when. */}
        {ligados && verAvisos
          ? avisos.map((aviso, indice) => (
              <View key={aviso.id} style={styles.aviso}>
                <View style={styles.trilho}>
                  <View style={[styles.ponto, { backgroundColor: theme.accent }]} />
                  {indice < avisos.length - 1 ? (
                    <View style={[styles.traco, { backgroundColor: theme.backgroundSelected }]} />
                  ) : null}
                </View>
                <View style={[styles.flex, styles.avisoTexto]}>
                  <ThemedText type="small">{aviso.titulo}</ThemedText>
                  <ThemedText type="small" themeColor="textMuted">
                    {`${formatarDiaCurto(aviso.quando, agora)} · ${formatarHora(aviso.quando)}`}
                  </ThemedText>
                </View>
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
    gap: Spacing.two,
  },
  trilho: {
    width: 12,
    alignItems: 'center',
    paddingTop: 6,
  },
  ponto: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  traco: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -6,
    borderRadius: 1,
  },
  avisoTexto: {
    paddingBottom: Spacing.one,
  },
});
