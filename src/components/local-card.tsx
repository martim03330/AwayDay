import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { formatarDistancia } from '@/lib/formatos';
import { nomesTipoLocal } from '@/mocks/locais';
import type { Local } from '@/mocks/tipos';
import { Badge } from '@/ui/badge';
import { Card } from '@/ui/card';
import { ContadorPessoas } from '@/ui/contador-pessoas';
import { Medidor } from '@/ui/medidor';
import { ThemedText } from '@/ui/themed-text';

type LocalCardProps = {
  local: Local;
  pessoas: number;
  checkedIn: boolean;
  onPress: () => void;
};

export function LocalCard({ local, pessoas, checkedIn, onPress }: LocalCardProps) {
  const distancia = `${local.minutosAPe} min a pé (${formatarDistancia(local.distanciaMetros)})`;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${local.nome}, ${nomesTipoLocal[local.tipo]}, ${distancia} do estádio, cervejómetro ${local.cervejometro} de 5, petiscómetro ${local.petiscometro} de 5, ${pessoas} pessoas aqui`}>
      <View style={styles.topo}>
        <View style={styles.flex}>
          <ThemedText type="smallBold" style={styles.nome}>
            {local.nome}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {nomesTipoLocal[local.tipo]} · {'€'.repeat(local.precoMedio)} · 🚶 {distancia}
          </ThemedText>
        </View>
        {checkedIn ? <Badge label="Estás aqui" /> : null}
      </View>

      <View style={styles.rodape}>
        <View style={styles.medidores}>
          <Medidor compact label="Cervejómetro" emoji="🍺" value={local.cervejometro} />
          <Medidor compact label="Petiscómetro" emoji="🍢" value={local.petiscometro} />
        </View>
        <ContadorPessoas count={pessoas} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  topo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  nome: {
    fontSize: 17,
    lineHeight: 24,
  },
  rodape: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  medidores: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
});
