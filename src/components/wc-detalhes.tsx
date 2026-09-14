import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { estadoDeAbertura, nomesAcesso, nomesTipoWc } from '@/lib/casas-de-banho';
import { formatarDistancia, formatarPreco } from '@/lib/formatos';
import { jogos } from '@/mocks/jogos';
import type { Restroom } from '@/mocks/tipos';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type WcDetalhesProps = {
  wc: Restroom;
  metros: number;
  minutos: number;
};

/** Informação prática de uma casa de banho: onde, se está aberta, quanto custa e acesso. A piada vem no fim. */
export function WcDetalhes({ wc, metros, minutos }: WcDetalhesProps) {
  const theme = useTheme();
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
        <IconCircle name={icons.wc} tone={abertura.aberta ? 'sky' : 'neutral'} />
        <View style={styles.textos}>
          <ThemedText style={styles.nome} numberOfLines={2}>
            {wc.nome}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitulo}>
            {`${formatarDistancia(metros)} a pé · ${nomesTipoWc[wc.tipo]}`}
          </ThemedText>
        </View>
        <View style={styles.tempo}>
          <Icon name={icons.aPe} size={16} color={theme.textSecondary} />
          <ThemedText style={styles.minutos}>{`${minutos} min`}</ThemedText>
        </View>
      </View>

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

      <View style={[styles.rodape, { borderTopColor: theme.border }]}>
        <ThemedText themeColor="textSecondary" style={styles.nota}>
          {wc.nota}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  nome: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  subtitulo: {
    fontSize: 13,
    lineHeight: 18,
  },
  tempo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  minutos: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  rodape: {
    paddingTop: 10,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
  },
  nota: {
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 18,
  },
});
