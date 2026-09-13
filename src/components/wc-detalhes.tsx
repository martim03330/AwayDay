import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { estadoDeAbertura, nomesAcesso, nomesTipoWc } from '@/lib/casas-de-banho';
import { formatarDistancia, formatarPreco } from '@/lib/formatos';
import { jogos } from '@/mocks/jogos';
import type { Restroom } from '@/mocks/tipos';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type WcDetalhesProps = {
  wc: Restroom;
  metros: number;
  minutos: number;
};

/** Informação prática de uma casa de banho: onde, se está aberta, quanto custa e acesso. A piada vem no fim. */
export function WcDetalhes({ wc, metros, minutos }: WcDetalhesProps) {
  const agora = useNow();
  const abertura = estadoDeAbertura(wc, new Date(agora), jogos);
  const preco = wc.gratuita ? 'Grátis' : formatarPreco(wc.precoEuros);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={[
        wc.nome,
        `${minutos} minutos a pé, ${formatarDistancia(metros)}`,
        abertura.texto,
        preco,
        wc.acessivel ? 'acessível' : 'sem acesso adaptado',
        nomesAcesso[wc.acesso],
        wc.nota,
      ].join('. ')}>
      <View style={styles.topo}>
        <ThemedText type="smallBold" style={styles.flex} numberOfLines={2}>
          {wc.nome}
        </ThemedText>
        <ThemedText type="smallBold">🚶 {minutos} min</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {`${formatarDistancia(metros)} a pé · ${nomesTipoWc[wc.tipo]}`}
      </ThemedText>

      <View style={styles.etiquetas}>
        <Etiqueta
          icon={icons.horario}
          label={abertura.texto}
          tone={abertura.aberta ? 'positivo' : 'negativo'}
        />
        <Etiqueta icon={icons.preco} label={preco} tone={wc.gratuita ? 'positivo' : 'neutro'} />
        <Etiqueta
          icon={icons.acessivel}
          label={wc.acessivel ? 'Acessível' : 'Sem acesso adaptado'}
          tone={wc.acessivel ? 'positivo' : 'aviso'}
        />
        <Etiqueta
          icon={icons.acesso}
          label={nomesAcesso[wc.acesso]}
          tone={wc.acesso === 'livre' ? 'positivo' : 'neutro'}
        />
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.nota}>
        {wc.nota}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  nota: {
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 18,
  },
});
