import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { formatarDia } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { obterEstadio } from '@/mocks/estadios';
import { obterLocal } from '@/mocks/locais';
import type { VisitaLocal } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type HistoricoTascosProps = {
  visitas: readonly VisitaLocal[];
  onAbrirLocal: (localId: string) => void;
};

export function HistoricoTascos({ visitas, onAbrirLocal }: HistoricoTascosProps) {
  if (visitas.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={icons.tasco}
          title="Passaporte sem tascos"
          message="Faz check-in antes do jogo e começa a coleção."
        />
      </Card>
    );
  }

  const verificadas = visitas.filter((visita) => visita.verificado).length;
  const ordenadas = [...visitas].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary" style={styles.resumo}>
        {`${plural(verificadas, 'verificado', 'verificados')} · ${plural(visitas.length - verificadas, 'por verificar', 'por verificar')}. Só os verificados contam para a pontuação.`}
      </ThemedText>
      {ordenadas.map((visita) => {
        const local = obterLocal(visita.localId);
        if (!local) return null;
        const estadio = obterEstadio(local.estadioId);
        const dia = formatarDia(new Date(visita.data));

        return (
          <Card
            key={visita.id}
            onPress={() => onAbrirLocal(local.id)}
            accessibilityLabel={`${local.nome}, ${dia}, ${visita.verificado ? 'verificado' : 'por verificar'}. Abrir local.`}>
            <View style={styles.linha}>
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {local.nome}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {`${dia}${estadio ? ` · perto do ${estadio.nome}` : ''}`}
                </ThemedText>
              </View>
              <Etiqueta
                icon={visita.verificado ? icons.selecionado : icons.porVerificar}
                label={visita.verificado ? 'Verificado' : 'Por verificar'}
                tone={visita.verificado ? 'positivo' : 'aviso'}
              />
            </View>
          </Card>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  resumo: {
    paddingHorizontal: Spacing.one,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
});
