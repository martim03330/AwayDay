import { Pressable, StyleSheet, View } from 'react-native';

import { corFacilidade } from '@/components/facilidade-parque';
import { Radius, Spacing } from '@/constants/theme';
import type { ParkingSpot } from '@/features/parking/api';
import { useTheme } from '@/hooks/use-theme';
import { formatarHora } from '@/lib/datas';
import {
  facilidadeEstacionamento,
  minutosAPe,
  minutosExtraDoParque,
  ROTULO_FACILIDADE,
} from '@/lib/facilidade-estacionamento';
import { chegadaRecomendada } from '@/lib/hora-saida';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

// Where the driver says they will leave the car. Every car park within 3 km is here, the ones further out included:
// on match day those are often the ones still with space. The colour and its words («Costuma haver lugar», «Enche
// cedo») are an estimate (distance, size, known closures), never live occupancy — nobody publishes that for free.

function Opcao({
  nome,
  valor,
  detalhe,
  nota,
  cor,
  escolhido,
  onPress,
}: {
  nome: string;
  /** The one number on screen, at the right: «8 min a pé». */
  valor?: string;
  /** How easy it is to park there, read by VoiceOver (on screen it is the dot's colour). */
  detalhe?: string;
  /** When to be there for it to still have a space (VoiceOver only). */
  nota?: string;
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
      accessibilityLabel={[nome, valor, detalhe, nota].filter(Boolean).join('. ')}
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
      <ThemedText type="smallBold" style={styles.texto}>
        {nome}
      </ThemedText>
      {valor ? (
        <ThemedText type="small" themeColor="textSecondary">
          {valor}
        </ThemedText>
      ) : null}
      {escolhido ? <Icon name={icons.selecionado} size={16} color={theme.accentInk} /> : null}
    </Pressable>
  );
}

export function EscolherParque({
  parques,
  escolhido,
  onEscolher,
  jogoGrande,
  inicio,
}: {
  parques: readonly ParkingSpot[];
  escolhido: string | null;
  onEscolher: (parqueId: string | null) => void;
  jogoGrande: boolean;
  /** Kick-off, to say by when you have to be at each car park. */
  inicio: string;
}) {
  const theme = useTheme();

  if (parques.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Ainda sem parques verificados perto deste estádio. Combinem no caminho.
      </ThemedText>
    );
  }

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        Quem vai contigo vê onde fica o carro.
      </ThemedText>
      <View style={styles.lista}>
        <Opcao
          nome="Ainda não sei"
          cor={null}
          escolhido={escolhido === null}
          onPress={() => onEscolher(null)}
        />
        {parques.map((parque) => {
          const { nivel } = facilidadeEstacionamento(parque, { jogoGrande });
          const minutos = minutosAPe(parque.distanceM);
          const chegada = chegadaRecomendada({
            inicio,
            minutosAPeDoParque: minutos,
            minutosExtraDoParque: minutosExtraDoParque(parque, { jogoGrande }),
            jogoGrande,
          });
          return (
            <Opcao
              key={parque.id}
              nome={parque.name}
              // How far on screen; whether it fills is the dot's colour (and the words, for VoiceOver).
              valor={minutos !== null ? `${minutos} min a pé` : undefined}
              detalhe={ROTULO_FACILIDADE[nivel]}
              nota={`Chega até às ${formatarHora(chegada)}`}
              cor={corFacilidade(theme, nivel)}
              escolhido={escolhido === parque.id}
              onPress={() => onEscolher(parque.id)}
            />
          );
        })}
      </View>
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
    paddingHorizontal: Spacing.twoAndHalf,
    paddingVertical: Spacing.twoAndHalf,
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
