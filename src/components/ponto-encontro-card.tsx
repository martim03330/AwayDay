import { StyleSheet } from 'react-native';

import { LinhaQueAbre } from '@/components/linha-que-abre';
import { Spacing } from '@/constants/theme';
import type { OrigemPontoEncontro, PontoEncontro } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { ThemedText } from '@/ui/themed-text';

const origens: Record<OrigemPontoEncontro, string> = {
  clube: 'Indicado pelo clube',
  camara: 'Indicado pela câmara',
  policia: 'Indicado pela polícia',
};

/** The official meeting point in one grouped card: where, when, how to get there, and who said so (on tap). */
export function PontoEncontroCard({ ponto }: { ponto: PontoEncontro | null }) {
  if (!ponto) {
    return (
      <Card>
        <EmptyState
          icon={icons.pontoEncontro}
          title="Ainda sem ponto de encontro"
          message="Nem clube, nem câmara, nem polícia marcaram sítio. Vê os canais oficiais perto do jogo."
        />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <LinhaGrupo
        leading={<IconCircle name={icons.pontoEncontro} tone="yellow" />}
        title={ponto.nome}
        subtitle={ponto.morada}
        separador
      />
      <LinhaGrupo
        leading={<IconCircle name={icons.horario} />}
        title={ponto.horario}
        subtitle="Horário"
        separador
      />
      <LinhaGrupo
        leading={<IconCircle name={icons.autocarro} tone="sky" />}
        title={ponto.transporte}
        subtitle="Transporte"
        separador
      />
      <LinhaQueAbre
        leading={<IconCircle name={icons.selecionado} />}
        title={origens[ponto.origem]}
        subtitle={ponto.nota ? 'Nota e fonte' : 'Ver a fonte'}>
        {ponto.nota ? (
          <ThemedText type="small" themeColor="textSecondary">
            {ponto.nota}
          </ThemedText>
        ) : null}
        <ThemedText type="smallBold" themeColor="textSecondary">
          {`Fonte: ${ponto.publicadoPor} · ${ponto.fonte.titulo}, ${ponto.fonte.publicadoEm}`}
        </ThemedText>
        {ponto.fonte.jogoOriginal ? (
          <ThemedText type="small" themeColor="textSecondary">
            {`Publicado para o jogo ${ponto.fonte.jogoOriginal}.`}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textMuted" selectable numberOfLines={2}>
          {ponto.fonte.url}
        </ThemedText>
      </LinhaQueAbre>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
});
