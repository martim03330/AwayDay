import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/ui/themed-text';

type LinhaDetalhesProps = {
  /** Partes a juntar com "·"; `null` é ignorado. */
  partes: readonly (string | null)[];
};

/**
 * Linha de detalhes secundários ("4,00 € · pronto em 5 min · 47 recomendações").
 * Só parte linha entre partes, nunca a meio de uma (ex.: "47" numa linha e "recomendações" noutra). O «·» fica no
 * fim da parte anterior, para uma linha nova nunca começar com um ponto solto.
 */
export function LinhaDetalhes({ partes }: LinhaDetalhesProps) {
  const visiveis = partes.filter((parte): parte is string => Boolean(parte));

  return (
    <View style={styles.linha} accessible accessibilityLabel={visiveis.join(', ')}>
      {visiveis.map((parte, indice) => (
        <ThemedText
          key={`${indice}-${parte}`}
          type="small"
          themeColor="textSecondary"
          numberOfLines={1}>
          {indice < visiveis.length - 1 ? `${parte} ·` : parte}
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 2,
  },
});
