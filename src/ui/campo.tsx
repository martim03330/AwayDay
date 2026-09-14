import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fontFamily, Radius, Spacing } from '@/constants/theme';
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
  const [focado, setFocado] = useState(false);
  const mensagem = erro ?? ajuda;

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View
        style={[
          styles.caixa,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          focado && { borderColor: theme.accent, borderWidth: 2, ...styles.anel },
          erro ? { borderColor: theme.danger, borderWidth: 2 } : null,
        ]}>
        <TextInput
          {...input}
          secureTextEntry={secureTextEntry && !visivel}
          autoCorrect={false}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          placeholderTextColor={theme.textMuted}
          selectionColor={theme.accent}
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
            <ThemedText style={styles.alternarTexto} themeColor="textSecondary">
              {visivel ? 'Esconder' : 'Mostrar'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      {erro ? (
        <ThemedText
          style={[styles.mensagem, styles.erro, { color: theme.danger }]}
          accessibilityLiveRegion="polite">
          {erro}
        </ThemedText>
      ) : ajuda ? (
        <ThemedText style={styles.mensagem} themeColor="textSecondary">
          {ajuda}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 7,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 800,
  },
  caixa: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.field,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  anel: {
    boxShadow: '0 0 0 4px #DDF2E3',
  },
  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fontFamily('body', 500),
  },
  alternar: {
    paddingHorizontal: 14,
    paddingVertical: Spacing.two,
  },
  alternarTexto: {
    fontSize: 14,
    fontWeight: 800,
  },
  mensagem: {
    fontSize: 13,
    lineHeight: 18,
  },
  erro: {
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.6,
  },
});
