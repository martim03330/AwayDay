import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CondicaoMeteorologica, Meteorologia } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Icon, IconCircle, icons, type IconName, type IconTone } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

const condicoes: Record<CondicaoMeteorologica, { nome: string; icon: IconName; tone: IconTone }> = {
  sol: { nome: 'Sol', icon: icons.sol, tone: 'yellow' },
  limpo: { nome: 'Céu limpo', icon: icons.limpo, tone: 'yellow' },
  nublado: { nome: 'Nublado', icon: icons.nublado, tone: 'sky' },
  aguaceiros: { nome: 'Aguaceiros', icon: icons.aguaceiros, tone: 'sky' },
  chuva: { nome: 'Chuva', icon: icons.chuva, tone: 'sky' },
};

export function MeteorologiaCard({ meteorologia }: { meteorologia: Meteorologia }) {
  const theme = useTheme();
  const condicao = condicoes[meteorologia.condicao];
  const chuva = meteorologia.probabilidadeChuva;

  return (
    <Card
      style={styles.card}
      accessibilityLabel={`${condicao.nome}, ${meteorologia.temperatura} graus, ${chuva !== null ? `${chuva}% de probabilidade de chuva, ` : ''}vento a ${meteorologia.ventoKmh} quilómetros por hora${meteorologia.fonte ? `. Previsão ${meteorologia.fonte}` : ''}`}>
      <IconCircle name={condicao.icon} size={26} tone={condicao.tone} />
      <View style={styles.corpo}>
        <ThemedText type="score" style={styles.temperatura}>
          {meteorologia.temperatura} °C
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {condicao.nome} à hora do jogo
        </ThemedText>
        {meteorologia.fonte ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.fonte}>
            Previsão {meteorologia.fonte}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.detalhes}>
        {chuva !== null ? (
          <View style={styles.detalhe}>
            <Icon name={icons.probabilidadeChuva} size={16} color={theme.info} />
            <ThemedText style={[styles.detalheTexto, { color: theme.info }]}>{chuva}%</ThemedText>
          </View>
        ) : null}
        <View style={styles.detalhe}>
          <Icon name={icons.vento} size={16} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.detalheTexto}>
            {meteorologia.ventoKmh} km/h
          </ThemedText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  corpo: {
    flex: 1,
    gap: Spacing.half,
  },
  temperatura: {
    fontSize: 34,
    lineHeight: 38,
  },
  fonte: {
    fontSize: 12,
    lineHeight: 16,
  },
  detalhes: {
    gap: 6,
  },
  detalhe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detalheTexto: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: 800,
  },
});
