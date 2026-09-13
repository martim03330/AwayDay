import { StyleSheet, View } from 'react-native';

import { Equipa } from '@/components/equipa';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora, formatarHora } from '@/lib/datas';
import { formatarNota } from '@/lib/formatos';
import { notaMedia, type EstadoJogo } from '@/lib/jogos';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { nomesCompeticao } from '@/mocks/jogos';
import type { Avaliacao, Jogo } from '@/mocks/tipos';
import { Badge } from '@/ui/badge';
import { Card } from '@/ui/card';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';
import { ThemedView } from '@/ui/themed-view';

type JogoCardProps = {
  jogo: Jogo;
  estado: EstadoJogo;
  avaliacao: Avaliacao | undefined;
  onPress: () => void;
};

const rotulosEstado: Record<EstadoJogo, string | null> = {
  agendado: null,
  'a-decorrer': 'A decorrer',
  terminado: 'Terminado',
};

export function JogoCard({ jogo, estado, avaliacao, onPress }: JogoCardProps) {
  const theme = useTheme();
  const casa = obterClube(jogo.casaId);
  const fora = obterClube(jogo.foraId);
  const estadio = obterEstadio(jogo.estadioId);
  if (!casa || !fora) return null;

  const inicio = new Date(jogo.inicio);
  const rotuloEstado = rotulosEstado[estado];
  const media = avaliacao ? formatarNota(notaMedia(avaliacao)) : null;
  const nota = media ? `★ ${media}` : null;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={[
        `${casa.nomeCurto} contra ${fora.nomeCurto}`,
        formatarDiaEHora(inicio),
        nomesCompeticao[jogo.competicao],
        rotuloEstado,
        media ? `avaliado com ${media} de 5` : null,
      ]
        .filter(Boolean)
        .join(', ')}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centro}>
        {nomesCompeticao[jogo.competicao]} · {jogo.fase}
      </ThemedText>

      {rotuloEstado || nota ? (
        <View style={styles.badges}>
          {rotuloEstado ? (
            <Badge label={rotuloEstado} tone={estado === 'a-decorrer' ? 'accent' : 'neutral'} />
          ) : null}
          {nota ? <Badge label={nota} /> : null}
        </View>
      ) : null}

      <View style={styles.equipas}>
        <Equipa clube={casa} />
        <ThemedView style={styles.hora}>
          <ThemedText style={styles.horaTexto}>{formatarHora(inicio)}</ThemedText>
        </ThemedView>
        <Equipa clube={fora} />
      </View>

      {estadio ? (
        <View style={styles.estadio}>
          <Icon name={icons.estadio} size={13} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {estadio.nome}
          </ThemedText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  centro: {
    textAlign: 'center',
  },
  badges: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  equipas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  hora: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  horaTexto: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  estadio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
});
