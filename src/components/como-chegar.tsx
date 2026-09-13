import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarPreco } from '@/lib/formatos';
import type { ModoTransporte, OpcaoTransporte } from '@/mocks/tipos';
import { Badge } from '@/ui/badge';
import { Card } from '@/ui/card';
import { IconCircle, icons, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

const modos: Record<ModoTransporte, { nome: string; icon: IconName }> = {
  metro: { nome: 'Metro', icon: icons.metro },
  autocarro: { nome: 'Autocarro', icon: icons.autocarro },
  comboio: { nome: 'Comboio', icon: icons.comboio },
  tvde: { nome: 'TVDE', icon: icons.tvde },
  'a-pe': { nome: 'A pé', icon: icons.aPe },
  carro: { nome: 'Carro', icon: icons.carro },
};

export function ComoChegar({ opcoes }: { opcoes: readonly OpcaoTransporte[] }) {
  const theme = useTheme();
  const maisRapida = Math.min(...opcoes.map((opcao) => opcao.minutos));

  return (
    <Card>
      {opcoes.map((opcao, index) => {
        const modo = modos[opcao.modo];
        return (
          <View
            key={`${opcao.modo}-${index}`}
            accessible
            accessibilityLabel={`${modo.nome}: ${opcao.descricao}. ${opcao.minutos} minutos, ${formatarPreco(opcao.precoEuros)}`}
            style={[
              styles.opcao,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
            ]}>
            <IconCircle name={modo.icon} />
            <View style={styles.corpo}>
              <View style={styles.titulo}>
                <ThemedText type="smallBold">{modo.nome}</ThemedText>
                {opcao.minutos === maisRapida ? <Badge label="Mais rápido" /> : null}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {opcao.descricao}
              </ThemedText>
            </View>
            <View style={styles.valores}>
              <ThemedText type="smallBold">{opcao.minutos} min</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatarPreco(opcao.precoEuros)}
              </ThemedText>
            </View>
          </View>
        );
      })}
      <ThemedText type="small" themeColor="textSecondary">
        Tempos e preços estimados por pessoa.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  corpo: {
    flex: 1,
    gap: Spacing.half,
  },
  titulo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  valores: {
    alignItems: 'flex-end',
  },
});
