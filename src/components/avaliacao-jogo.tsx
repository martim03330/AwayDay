import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarNota } from '@/lib/formatos';
import { estadoDoJogo, notaMedia } from '@/lib/jogos';
import type { AvaliacaoVisita, Jogo } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type AvaliacaoJogoProps = {
  jogo: Jogo;
  agora: number;
  avaliacao: AvaliacaoVisita | undefined;
  onAvaliar: () => void;
};

/** Yellow star tile, as in the design's "Avaliação da experiência" card. */
function TileEstrela() {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.warningBackground }]}>
      <Icon name={icons.estrela} size={24} color={theme.warning} />
    </View>
  );
}

export function AvaliacaoJogo({ jogo, agora, avaliacao, onAvaliar }: AvaliacaoJogoProps) {
  const theme = useTheme();

  // Before the final whistle there is nothing to rate: the section stays out of the way instead of a placeholder.
  if (estadoDoJogo(jogo, agora) !== 'terminado') return null;

  if (!avaliacao) {
    return (
      <Card style={styles.card}>
        <View style={styles.linhaTile}>
          <TileEstrela />
          <View style={styles.textos}>
            <ThemedText type="section" style={styles.pergunta}>
              Como foi o jogo?
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Dá nota ao estádio, ao ambiente e aos acessos.
            </ThemedText>
          </View>
        </View>
        <Button
          label="Avaliar experiência"
          icon={icons.estrela}
          variant="highlight"
          onPress={onAvaliar}
        />
      </Card>
    );
  }

  const media = notaMedia(avaliacao);
  const notas = [
    { rotulo: 'Estádio', valor: avaliacao.estadio },
    { rotulo: 'Ambiente', valor: avaliacao.ambiente },
    { rotulo: 'Acessos', valor: avaliacao.acessos },
  ];

  return (
    <Card style={styles.card}>
      <View style={styles.topo}>
        <ThemedText style={[styles.titulo, styles.flex]}>A tua avaliação</ThemedText>
        <View
          accessible
          accessibilityLabel={`Nota média ${formatarNota(media)} de 5`}
          style={[styles.media, { backgroundColor: theme.warningBackground }]}>
          <Icon name={icons.estrela} size={14} color={theme.warning} />
          <ThemedText style={[styles.mediaTexto, { color: theme.warning }]}>
            {formatarNota(media)}
          </ThemedText>
        </View>
      </View>

      <View
        style={styles.notas}
        accessible
        accessibilityLabel={notas.map(({ rotulo, valor }) => `${rotulo} ${valor}`).join(', ')}>
        {notas.map(({ rotulo, valor }) => (
          <View key={rotulo} style={[styles.nota, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              {rotulo}
            </ThemedText>
            <ThemedText type="score" style={styles.valorNota}>
              {valor}
            </ThemedText>
          </View>
        ))}
      </View>

      {avaliacao.comentario ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.comentario}>
          “{avaliacao.comentario}”
        </ThemedText>
      ) : null}
      <Button
        label="Editar avaliação"
        icon={icons.estrela}
        variant="secondary"
        onPress={onAvaliar}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  linhaTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 800,
  },
  pergunta: {
    fontSize: 26,
    lineHeight: 30,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  media: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 30,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
  mediaTexto: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  notas: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  nota: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  valorNota: {
    fontSize: 28,
    lineHeight: 32,
  },
  comentario: {
    fontStyle: 'italic',
  },
});
