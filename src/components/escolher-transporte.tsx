import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import type { UsualTransport } from '@/features/profile/types';
import { useTheme } from '@/hooks/use-theme';
import { Icon, icons, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

export const OPCOES_TRANSPORTE: readonly {
  valor: UsualTransport;
  icon: IconName;
  titulo: string;
  /** Read by VoiceOver only: on screen each option is just its title. */
  detalhe: string;
}[] = [
  {
    valor: 'driver',
    icon: icons.carro,
    titulo: 'Vou de carro e posso dar boleia',
    detalhe: 'Nas boleias de cada jogo, oferecer lugares no teu carro aparece logo em cima.',
  },
  {
    valor: 'passenger',
    icon: icons.perfil,
    titulo: 'Costumo precisar de boleia',
    detalhe: 'As boleias que saem mais perto de ti aparecem primeiro.',
  },
  {
    valor: 'public_transport',
    icon: icons.comboio,
    titulo: 'Vou de transportes',
    detalhe: 'Comboio, autocarro ou metro. Se um dia precisares, as boleias continuam lá.',
  },
];

type EscolherTransporteProps = {
  valor: UsualTransport | null;
  onChange: (valor: UsualTransport) => void;
};

/** One choice, three big rows. It only changes what shows up first; nothing is hidden. */
export function EscolherTransporte({ valor, onChange }: EscolherTransporteProps) {
  const theme = useTheme();
  return (
    <View style={styles.lista} accessibilityRole="radiogroup">
      {OPCOES_TRANSPORTE.map((opcao) => {
        const escolhida = opcao.valor === valor;
        return (
          <Pressable
            key={opcao.valor}
            onPress={() => onChange(opcao.valor)}
            accessibilityRole="radio"
            accessibilityState={{ checked: escolhida }}
            accessibilityLabel={`${opcao.titulo}. ${opcao.detalhe}`}
            style={({ pressed }) => [
              styles.opcao,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: escolhida ? theme.accent : theme.border,
              },
              pressed && styles.premido,
            ]}>
            <View
              style={[
                styles.azulejo,
                { backgroundColor: escolhida ? theme.accent : theme.backgroundSelected },
              ]}>
              <Icon
                name={opcao.icon}
                size={22}
                color={escolhida ? theme.accentText : theme.textSecondary}
              />
            </View>
            <ThemedText type="smallBold" style={[styles.texto, styles.titulo]}>
              {opcao.titulo}
            </ThemedText>
            {escolhida ? <Icon name={icons.selecionado} size={20} color={theme.accentInk} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: Spacing.twoAndHalf,
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: 2,
  },
  azulejo: {
    width: 44,
    height: 44,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: {
    flex: 1,
  },
  titulo: {
    fontSize: 15,
    lineHeight: 20,
  },
  premido: {
    opacity: 0.8,
  },
});
