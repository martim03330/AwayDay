import { Pressable, StyleSheet, View } from 'react-native';

import { corFacilidade, LegendaFacilidade } from '@/components/facilidade-parque';
import { Radius, Spacing } from '@/constants/theme';
import type { ParkingSpot } from '@/features/parking/api';
import { useTheme } from '@/hooks/use-theme';
import { facilidadeEstacionamento, minutosAPe } from '@/lib/facilidade-estacionamento';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

// Where the driver says they will leave the car. Every car park within 3 km is here, the ones further out included:
// on match day those are often the ones still with space. The colour is an estimate (distance, size, known closures),
// never live occupancy — nobody publishes that for free — and the text under the list says so.

function Opcao({
  nome,
  detalhe,
  cor,
  escolhido,
  onPress,
}: {
  nome: string;
  detalhe: string;
  cor: string | null;
  escolhido: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: escolhido }}
      accessibilityLabel={`${nome}. ${detalhe}`}
      style={({ pressed }) => [
        styles.opcao,
        {
          backgroundColor: escolhido ? theme.backgroundSelected : 'transparent',
          borderColor: escolhido ? theme.accent : theme.border,
        },
        pressed && styles.pressed,
      ]}>
      {cor ? (
        <View style={[styles.bola, { backgroundColor: cor }]} />
      ) : (
        <View style={styles.bola} />
      )}
      <View style={styles.texto}>
        <ThemedText type="smallBold">{nome}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {detalhe}
        </ThemedText>
      </View>
      {escolhido ? <Icon name={icons.selecionado} size={16} color={theme.accent} /> : null}
    </Pressable>
  );
}

export function EscolherParque({
  parques,
  escolhido,
  onEscolher,
  jogoGrande,
}: {
  parques: readonly ParkingSpot[];
  escolhido: string | null;
  onEscolher: (parqueId: string | null) => void;
  jogoGrande: boolean;
}) {
  const theme = useTheme();

  if (parques.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Ainda não temos parques verificados perto deste estádio. Combina com a malta no ponto de
        encontro.
      </ThemedText>
    );
  }

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        Quem vai contigo vê onde deixam o carro. A cor é a nossa estimativa de encontrar lugar.
      </ThemedText>
      <View style={styles.lista}>
        <Opcao
          nome="Ainda não sei"
          detalhe="Decides no caminho e dizes à malta."
          cor={null}
          escolhido={escolhido === null}
          onPress={() => onEscolher(null)}
        />
        {parques.map((parque) => {
          const { nivel, motivo } = facilidadeEstacionamento(parque, { jogoGrande });
          const minutos = minutosAPe(parque.distanceM);
          return (
            <Opcao
              key={parque.id}
              nome={parque.name}
              detalhe={[minutos !== null ? `${minutos} min a pé do estádio` : null, motivo]
                .filter(Boolean)
                .join(' · ')}
              cor={corFacilidade(theme, nivel)}
              escolhido={escolhido === parque.id}
              onPress={() => onEscolher(parque.id)}
            />
          );
        })}
      </View>
      <LegendaFacilidade />
    </>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: 8,
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  bola: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  texto: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
