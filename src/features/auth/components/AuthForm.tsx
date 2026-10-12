import { useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAnunciarErro } from '@/ui/campo';
import { Icon, icons, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type AuthFormProps = {
  /** One sentence explaining the screen. Can hold bold parts (e.g. the email). */
  intro: ReactNode;
  /** Big display title above the intro. */
  title?: string;
  /** Tilted icon tile above the title, with an optional yellow tag. */
  hero?: { icon: IconName; tag?: string };
  /** Error from the last request, shown above the fields. */
  error?: string | null;
  /** Neutral confirmation, e.g. "We sent you another code". */
  notice?: string | null;
  children: ReactNode;
};

/** Shared layout for the account screens: scrolls above the keyboard. */
export function AuthForm({ intro, title, hero, error, notice, children }: AuthFormProps) {
  const theme = useTheme();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.ecra, { backgroundColor: theme.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.conteudo}>
        {hero ? (
          <View style={[styles.hero, { backgroundColor: theme.accent }]}>
            <Icon name={hero.icon} size={42} strokeWidth={1.8} color={theme.accentText} />
            {hero.tag ? (
              <View style={[styles.heroTag, { backgroundColor: theme.highlight }]}>
                <ThemedText style={[styles.heroTagTexto, { color: theme.highlightText }]}>{hero.tag}</ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.cabecalho}>
          {title ? (
            <ThemedText type="title" style={styles.titulo} accessibilityRole="header">
              {title}
            </ThemedText>
          ) : null}
          <ThemedText style={styles.intro} themeColor="textSecondary">
            {intro}
          </ThemedText>
        </View>
        {error ? (
          <View
            accessible
            accessibilityRole="alert"
            style={[styles.caixa, { backgroundColor: theme.dangerBackground }]}>
            <Icon name={icons.erro} size={20} color={theme.dangerText} />
            <ThemedText style={[styles.caixaTexto, { color: theme.dangerText }]}>{error}</ThemedText>
          </View>
        ) : null}
        {notice ? (
          <View
            accessible
            accessibilityLiveRegion="polite"
            style={[styles.caixa, { backgroundColor: theme.successBackground }]}>
            <Icon name={icons.checkInFeito} size={20} color={theme.successText} />
            <ThemedText style={[styles.caixaTexto, { color: theme.successText }]}>{notice}</ThemedText>
          </View>
        ) : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type CampoCodigoProps = {
  label: string;
  value: string;
  onChangeText: (texto: string) => void;
  erro?: string | null;
  /** How many digits the code has (one box each). */
  digitos: number;
  /** Called once all the digits are in (typed, pasted or filled in from Mail): confirms without a tap. */
  onCompleto?: (codigo: string) => void;
} & Pick<TextInputProps, 'autoFocus' | 'onSubmitEditing' | 'returnKeyType'>;

/**
 * One-time code field: an almost transparent TextInput on top of one box per digit. The input keeps only digits
 * (a pasted «1234 5678» or the code iOS offers from Mail also work), the boxes mirror them.
 *
 * Testers lost the keyboard here (tapping the boxes did nothing once it was closed). Now the input never takes taps:
 * the boxes open the keyboard, every time. Since nobody can tap inside the text, typing and deleting always happen at
 * the end, and sending keeps the keyboard open.
 */
export function CampoCodigo({
  label,
  value,
  onChangeText,
  erro,
  digitos,
  onCompleto,
  ...input
}: CampoCodigoProps) {
  const theme = useTheme();
  useAnunciarErro(label, erro);
  const caixa = useRef<TextInput>(null);
  const [focado, setFocado] = useState(false);
  const algarismos = value.replace(/\D/g, '').slice(0, digitos);
  const metade = Math.floor(digitos / 2);

  // The boxes open the keyboard, not the hidden input (taps on a nearly invisible view are unreliable on iOS). If the
  // input still thinks it has focus with the keyboard gone, it lets go first, so the keyboard always comes back.
  function abrirTeclado() {
    const input = caixa.current;
    if (!input) return;
    if (input.isFocused()) {
      input.blur();
      setTimeout(() => input.focus(), 50);
    } else {
      input.focus();
    }
  }

  function mudar(texto: string) {
    const limpo = texto.replace(/\D/g, '').slice(0, digitos);
    onChangeText(limpo);
    if (limpo.length === digitos && algarismos.length < digitos) onCompleto?.(limpo);
  }

  return (
    <View style={styles.campo}>
      <ThemedText style={styles.label} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </ThemedText>
      <Pressable onPress={abrirTeclado} accessible={false} testID="caixas-do-codigo">
        <View
          style={styles.caixas}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {Array.from({ length: digitos }, (_, indice) => {
            const algarismo = algarismos[indice];
            const ativa = focado && indice === algarismos.length;
            return (
              <View key={indice} style={styles.grupoCaixa}>
                {indice === metade ? (
                  <View style={[styles.traco, { backgroundColor: theme.borderStrong }]} />
                ) : null}
                <View
                  style={[
                    styles.caixaDigito,
                    {
                      backgroundColor:
                        algarismo !== undefined || ativa ? theme.backgroundElement : theme.backgroundSelected,
                      borderColor: erro ? theme.danger : theme.border,
                    },
                    ativa && {
                      borderColor: theme.accent,
                      borderWidth: 2,
                      boxShadow: `0 0 0 4px ${theme.successBackground}`,
                    },
                  ]}>
                  {algarismo !== undefined ? (
                    <ThemedText type="score" style={styles.digito}>
                      {algarismo}
                    </ThemedText>
                  ) : ativa ? (
                    <View style={[styles.cursor, { backgroundColor: theme.accent }]} />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.inputInvisivel} pointerEvents="none">
          <TextInput
            // Sending never closes the keyboard: after a wrong code you can type the right one straight away.
            submitBehavior="submit"
            {...input}
            ref={caixa}
            value={algarismos}
            onChangeText={mudar}
            maxLength={digitos}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoCorrect={false}
            caretHidden
            onFocus={() => setFocado(true)}
            onBlur={() => setFocado(false)}
            accessibilityLabel={erro ? `${label}. Erro: ${erro}` : label}
            style={styles.inputCheio}
          />
        </View>
      </Pressable>
      {erro ? (
        <ThemedText
          style={[styles.mensagem, { color: theme.danger }]}
          accessibilityLiveRegion="polite"
          accessibilityElementsHidden>
          {erro}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ecra: {
    flex: 1,
  },
  conteudo: {
    gap: 20,
    paddingHorizontal: 22,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },
  hero: {
    width: 84,
    height: 84,
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
    borderRadius: 26,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  heroTag: {
    position: 'absolute',
    top: -8,
    right: -10,
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    transform: [{ rotate: '6deg' }],
  },
  heroTagTexto: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 800,
  },
  cabecalho: {
    gap: Spacing.two,
  },
  titulo: {
    fontSize: 44,
    lineHeight: 48,
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
  },
  caixa: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  caixaTexto: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  campo: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 800,
  },
  caixas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  grupoCaixa: {
    flex: 1,
    maxWidth: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  traco: {
    width: 8,
    height: 3,
    borderRadius: 2,
  },
  caixaDigito: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.field,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  digito: {
    fontSize: 26,
    lineHeight: 30,
  },
  cursor: {
    width: 2,
    height: 24,
  },
  inputInvisivel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    // Not 0: an input at opacity 0 may not take autofill. It never takes taps: the boxes do.
    opacity: 0.02,
  },
  inputCheio: {
    flex: 1,
    color: 'transparent',
  },
  mensagem: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 700,
  },
});
