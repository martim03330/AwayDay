import { useEffect, useState, type Ref } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

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
  /** To move the focus here from the field before (`returnKeyType="next"`). */
  ref?: Ref<TextInput>;
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
  | 'submitBehavior'
  | 'textContentType'
>;

/**
 * Campo de uma linha para formulários. Com `secureTextEntry`, mostra um botão para ver a password.
 *
 * Com `returnKeyType="next"`, o teclado fica aberto ao carregar em «seguinte» (o ecrã passa o foco ao campo
 * seguinte no `onSubmitEditing`). O erro faz parte do nome do campo para o leitor de ecrã e é anunciado quando
 * aparece.
 */
export function Campo({ label, erro, ajuda, secureTextEntry, ref, ...input }: CampoProps) {
  const theme = useTheme();
  const [visivel, setVisivel] = useState(false);
  const [focado, setFocado] = useState(false);
  useAnunciarErro(label, erro);

  return (
    <View style={styles.container}>
      {/* The input already says its label: read once, not twice. */}
      <ThemedText style={styles.label} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </ThemedText>
      <View
        style={[
          styles.caixa,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          focado && {
            borderColor: theme.accent,
            borderWidth: 2,
            boxShadow: `0 0 0 4px ${theme.successBackground}`,
          },
          erro ? { borderColor: theme.danger, borderWidth: 2 } : null,
        ]}>
        <TextInput
          submitBehavior={input.returnKeyType === 'next' ? 'submit' : undefined}
          {...input}
          ref={ref}
          secureTextEntry={secureTextEntry && !visivel}
          autoCorrect={false}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          placeholderTextColor={theme.textMuted}
          selectionColor={theme.accent}
          accessibilityLabel={erro ? `${label}. Erro: ${erro}` : label}
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
          // Android reads it from the live region; VoiceOver already hears it in the field's name.
          accessibilityLiveRegion="polite"
          accessibilityElementsHidden>
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

/**
 * Reads a field's error out loud when it appears or changes. Android does it from the live region on the message;
 * iOS has no live regions, so it is announced by hand.
 */
export function useAnunciarErro(label: string, erro: string | null | undefined) {
  useEffect(() => {
    if (erro && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(`${label}: ${erro}`);
  }, [label, erro]);
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
