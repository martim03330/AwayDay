import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { OrigemPontoEncontro, PontoEncontro } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';
import { ThemedText } from '@/ui/themed-text';

const origens: Record<OrigemPontoEncontro, string> = {
  clube: 'Indicado pelo clube',
  camara: 'Indicado pela câmara',
  policia: 'Indicado pela polícia',
};

export function PontoEncontroCard({ ponto }: { ponto: PontoEncontro | null }) {
  if (!ponto) {
    return (
      <Card>
        <EmptyState
          icon={icons.pontoEncontro}
          title="Ainda sem ponto de encontro"
          message="Ninguém marcou sítio para os visitantes: nem clube, nem câmara, nem polícia. Fica atento aos canais oficiais perto do jogo."
        />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <ListRow
        leading={<IconCircle name={icons.pontoEncontro} tone="yellow" />}
        title={ponto.nome}
        subtitle={ponto.morada}
      />
      <Etiqueta icon={icons.selecionado} label={origens[ponto.origem]} tone="positivo" />

      <ListRow leading={<IconCircle name={icons.horario} />} title="Horário" subtitle={ponto.horario} />
      <ListRow
        leading={<IconCircle name={icons.autocarro} tone="sky" />}
        title="Transporte"
        subtitle={ponto.transporte}
      />
      {ponto.nota ? (
        <ThemedText type="small" themeColor="textSecondary">
          {ponto.nota}
        </ThemedText>
      ) : null}

      <View style={styles.fonte}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {`Fonte: ${ponto.publicadoPor} · ${ponto.fonte.titulo}, ${ponto.fonte.publicadoEm}`}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {`Publicado para o jogo ${ponto.fonte.jogoOriginal}.`}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" selectable numberOfLines={2}>
          {ponto.fonte.url}
        </ThemedText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  fonte: {
    gap: Spacing.half,
  },
});
