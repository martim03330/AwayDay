import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Clube } from '@/mocks/tipos';
import { Escudo } from '@/ui/escudo';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type OpcaoClubeProps = {
  clube: Clube;
  detalhe: string;
  selecionado: boolean;
  onPress: () => void;
};

/** Linha de escolha de clube (botão de rádio) para os seletores do perfil. */
export function OpcaoClube({ clube, detalhe, selecionado, onPress }: OpcaoClubeProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selecionado }}
      accessibilityLabel={`${clube.nomeCurto}, ${detalhe}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.linha,
        { backgroundColor: selecionado ? theme.backgroundSelected : theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <Escudo clube={clube} size={36} />
      <View style={styles.flex}>
        <ThemedText type="smallBold">{clube.nomeCurto}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {detalhe}
        </ThemedText>
      </View>
      {selecionado ? <Icon name={icons.selecionado} size={22} color={theme.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
  },
  pressed: {
    opacity: 0.7,
  },
  flex: {
    flex: 1,
  },
});
