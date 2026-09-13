import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarPreco, plural } from '@/lib/formatos';
import { contagemDoPrato } from '@/lib/pratos';
import type { Prato } from '@/mocks/tipos';
import { Badge } from '@/ui/badge';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { LinhaDetalhes } from '@/ui/linha-detalhes';
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
              styles.prato,
              indice > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.border,
                paddingTop: Spacing.three,
              },
            ]}>
            {/* O nome usa a largura toda: o botão fica numa linha própria e não o empurra. */}
            <ThemedText type="smallBold" style={styles.nome}>
              {prato.nome}
            </ThemedText>
            {prato.especialidade ? <Badge label="Especialidade" /> : null}
            <LinhaDetalhes
              partes={[
                formatarPreco(prato.precoEuros),
                `pronto em ${prato.minutosPreparacao} min`,
                plural(total, 'recomendação', 'recomendações'),
              ]}
            />
            <View style={styles.acao}>
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
  prato: {
    gap: Spacing.one,
  },
  nome: {
    fontSize: 16,
    lineHeight: 22,
  },
  acao: {
    flexDirection: 'row',
    marginTop: Spacing.one,
  },
});
