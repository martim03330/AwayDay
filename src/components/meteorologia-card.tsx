import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CondicaoMeteorologica, Meteorologia } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Icon, icons, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

const condicoes: Record<CondicaoMeteorologica, { nome: string; icon: IconName }> = {
  sol: { nome: 'Sol', icon: icons.sol },
  limpo: { nome: 'Céu limpo', icon: icons.limpo },
  nublado: { nome: 'Nublado', icon: icons.nublado },
  aguaceiros: { nome: 'Aguaceiros', icon: icons.aguaceiros },
  chuva: { nome: 'Chuva', icon: icons.chuva },
};

export function MeteorologiaCard({ meteorologia }: { meteorologia: Meteorologia }) {
  const theme = useTheme();
  const condicao = condicoes[meteorologia.condicao];

  return (
    <Card
      style={styles.card}
      accessibilityLabel={`${condicao.nome}, ${meteorologia.temperatura} graus, ${meteorologia.probabilidadeChuva}% de probabilidade de chuva, vento a ${meteorologia.ventoKmh} quilómetros por hora`}>
      <Icon name={condicao.icon} size={40} color={theme.accent} />
      <View style={styles.corpo}>
        <ThemedText style={styles.temperatura}>{meteorologia.temperatura} °C</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {condicao.nome} à hora do jogo
        </ThemedText>
      </View>
      <View style={styles.detalhes}>
        <View style={styles.detalhe}>
          <Icon name={icons.probabilidadeChuva} size={13} color={theme.textSecondary} />
          <ThemedText type="small">{meteorologia.probabilidadeChuva}%</ThemedText>
        </View>
        <View style={styles.detalhe}>
          <Icon name={icons.vento} size={13} color={theme.textSecondary} />
          <ThemedText type="small">{meteorologia.ventoKmh} km/h</ThemedText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  corpo: {
    flex: 1,
  },
  temperatura: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  detalhes: {
    gap: Spacing.one,
  },
  detalhe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
