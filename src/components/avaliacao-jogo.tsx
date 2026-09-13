import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { formatarNota } from '@/lib/formatos';
import { estadoDoJogo, fimDoJogo, notaMedia } from '@/lib/jogos';
import type { Avaliacao, Jogo } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';
import { ThemedText } from '@/ui/themed-text';

type AvaliacaoJogoProps = {
  jogo: Jogo;
  agora: number;
  avaliacao: Avaliacao | undefined;
  onAvaliar: () => void;
};

export function AvaliacaoJogo({ jogo, agora, avaliacao, onAvaliar }: AvaliacaoJogoProps) {
  const theme = useTheme();

  if (estadoDoJogo(jogo, agora) !== 'terminado') {
    return (
      <Card>
        <ListRow
          leading={<IconCircle name={icons.estrela} />}
          title="Avaliação da experiência"
          subtitle={`Abre ${formatarDiaEHora(fimDoJogo(jogo)).toLowerCase()}, no fim do jogo.`}
        />
      </Card>
    );
  }

  if (!avaliacao) {
    return (
      <Card>
        <ListRow
          leading={<IconCircle name={icons.estrela} />}
          title="Como foi o jogo?"
          subtitle="Avalia o estádio, o ambiente e os acessos."
        />
        <Button label="Avaliar experiência" icon={icons.estrela} onPress={onAvaliar} />
      </Card>
    );
  }

  const media = notaMedia(avaliacao);

  return (
    <Card>
      <View style={styles.topo}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">A tua avaliação</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`Estádio ${avaliacao.estadio} · Ambiente ${avaliacao.ambiente} · Acessos ${avaliacao.acessos}`}
          </ThemedText>
        </View>
        <ThemedText
          style={[styles.media, { color: theme.accent }]}
          accessibilityLabel={`Nota média ${formatarNota(media)} de 5`}>
          ★ {formatarNota(media)}
        </ThemedText>
      </View>
      {avaliacao.comentario ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.comentario}>
          “{avaliacao.comentario}”
        </ThemedText>
      ) : null}
      <Button label="Editar avaliação" icon={icons.estrela} variant="secondary" onPress={onAvaliar} />
    </Card>
  );
}

const styles = StyleSheet.create({
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  media: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
  },
  comentario: {
    fontStyle: 'italic',
  },
});
