import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type AuthFormProps = {
  /** One sentence explaining the screen. */
  intro: string;
  /** Error from the last request, shown above the fields. */
  error?: string | null;
  /** Neutral confirmation, e.g. "We sent you another code". */
  notice?: string | null;
  children: ReactNode;
};

/** Shared layout for the account screens: scrolls above the keyboard. */
export function AuthForm({ intro, error, notice, children }: AuthFormProps) {
  const theme = useTheme();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.ecra, { backgroundColor: theme.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.conteudo}>
        <ThemedText themeColor="textSecondary">{intro}</ThemedText>
        {error ? (
          <View
            accessible
            accessibilityRole="alert"
            style={[styles.caixa, { backgroundColor: theme.dangerBackground }]}>
            <Icon name={icons.aviso} size={18} color={theme.danger} />
            <ThemedText type="small" style={[styles.flex, { color: theme.danger }]}>
              {error}
            </ThemedText>
          </View>
        ) : null}
        {notice ? (
          <View
            accessible
            accessibilityLiveRegion="polite"
            style={[styles.caixa, { backgroundColor: theme.successBackground }]}>
            <Icon name={icons.selecionado} size={18} color={theme.success} />
            <ThemedText type="small" style={styles.flex}>
              {notice}
            </ThemedText>
          </View>
        ) : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ecra: {
    flex: 1,
  },
  conteudo: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  caixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  flex: {
    flex: 1,
  },
});
