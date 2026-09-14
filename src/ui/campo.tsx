import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

type CampoProps = {
  label: string;
  value: string;
  onChangeText: (texto: string) => void;
  /** Mensagem de erro por baixo do campo; tem prioridade sobre a ajuda. */
  erro?: string | null;
  ajuda?: string;
} & Pick<
  TextInputProps,
  | 'autoCapitalize'
  | 'autoComplete'
  | 'autoFocus'
  | 'editable'
  | 'keyboardType'
  | 'maxLength'
  | 'onSubmitEditing'
  | 'placeholder'
  | 'returnKeyType'
  | 'secureTextEntry'
  | 'textContentType'
>;

/** Campo de uma linha para formulários. Com `secureTextEntry`, mostra um botão para ver a password. */
export function Campo({ label, erro, ajuda, secureTextEntry, ...input }: CampoProps) {
  const theme = useTheme();
  const [visivel, setVisivel] = useState(false);
  const mensagem = erro ?? ajuda;

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View
        style={[
          styles.caixa,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: erro ? theme.danger : theme.border,
          },
        ]}>
        <TextInput
          {...input}
          secureTextEntry={secureTextEntry && !visivel}
          autoCorrect={false}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={label}
          accessibilityHint={mensagem ?? undefined}
          style={[styles.input, { color: theme.text }]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setVisivel((atual) => !atual)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={visivel ? 'Esconder password' : 'Mostrar password'}
            style={({ pressed }) => [styles.alternar, pressed && styles.pressed]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {visivel ? 'Esconder' : 'Mostrar'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      {erro ? (
        <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
          {erro}
        </ThemedText>
      ) : ajuda ? (
        <ThemedText type="small" themeColor="textSecondary">
          {ajuda}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  caixa: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  alternar: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
