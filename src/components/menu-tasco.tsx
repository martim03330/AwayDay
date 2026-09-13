import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarPreco, plural } from '@/lib/formatos';
import { contagemDoPrato } from '@/lib/pratos';
import type { Prato } from '@/mocks/tipos';
import { Badge } from '@/ui/badge';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { ThemedText } from '@/ui/themed-text';

type MenuTascoProps = {
  pratos: readonly Prato[];
  recomendados: ReadonlySet<string>;
  onAlternarRecomendacao: (pratoId: string) => void;
};

export function MenuTasco({ pratos, recomendados, onAlternarRecomendacao }: MenuTascoProps) {
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      {pratos.map((prato, indice) => {
        const recomendado = recomendados.has(prato.id);
        const total = contagemDoPrato(prato, recomendados);
        return (
          <View
            key={prato.id}
            style={[
              styles.linha,
              indice > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.border,
                paddingTop: Spacing.three,
              },
            ]}>
            <View style={styles.flex}>
              <View style={styles.nome}>
                <ThemedText type="smallBold">{prato.nome}</ThemedText>
                {prato.especialidade ? <Badge label="Especialidade" /> : null}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {`${formatarPreco(prato.precoEuros)} · pronto em ${prato.minutosPreparacao} min · ${plural(total, 'recomendação', 'recomendações')}`}
              </ThemedText>
            </View>
            <Chip
              label={recomendado ? 'Recomendado' : 'Recomendo'}
              selected={recomendado}
              onPress={() => onAlternarRecomendacao(prato.id)}
              emCartao
              accessibilityLabel={
                recomendado
                  ? `Retirar a tua recomendação de ${prato.nome}`
                  : `Recomendar ${prato.nome}`
              }
            />
          </View>
        );
      })}
      <ThemedText type="small" themeColor="textSecondary">
        As recomendações são dos adeptos, não do dono. Recomenda só o que provaste.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  nome: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
