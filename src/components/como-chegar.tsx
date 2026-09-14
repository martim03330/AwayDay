import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarPreco } from '@/lib/formatos';
import type { ModoTransporte, OpcaoTransporte } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { IconCircle, icons, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

export const modosTransporte: Record<ModoTransporte, { nome: string; icon: IconName }> = {
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
    <Card style={styles.card}>
      {opcoes.map((opcao, index) => {
        const modo = modosTransporte[opcao.modo];
        return (
          <View
            key={`${opcao.modo}-${index}`}
            accessible
            accessibilityLabel={`${modo.nome}: ${opcao.descricao}. ${opcao.minutos} minutos, ${formatarPreco(opcao.precoEuros)}`}
            style={[
              styles.opcao,
              index > 0 && { borderTopWidth: 1, borderTopColor: theme.backgroundSelected },
            ]}>
            <IconCircle name={modo.icon} tone="sky" />
            <View style={styles.corpo}>
              <View style={styles.titulo}>
                <ThemedText style={styles.forte}>{modo.nome}</ThemedText>
                {opcao.minutos === maisRapida ? <Etiqueta label="Mais rápido" tone="info" /> : null}
              </View>
              <ThemedText themeColor="textSecondary" style={styles.secundario}>
                {opcao.descricao}
              </ThemedText>
            </View>
            <View style={styles.valores}>
              <ThemedText style={styles.forte}>{opcao.minutos} min</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.secundario}>
                {formatarPreco(opcao.precoEuros)}
              </ThemedText>
            </View>
          </View>
        );
      })}
      <ThemedText themeColor="textMuted" style={styles.nota}>
        Tempos e preços estimados por pessoa.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 0,
    paddingTop: Spacing.one,
    paddingBottom: 14,
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  corpo: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  titulo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  forte: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  secundario: {
    fontSize: 13,
    lineHeight: 18,
  },
  valores: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  nota: {
    fontSize: 12,
    lineHeight: 16,
    paddingTop: Spacing.one,
  },
});
