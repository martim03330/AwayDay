import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { IDADE_MINIMA } from '@/lib/legal';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type ConsentimentoTermosProps = {
  aceite: boolean;
  onMudar: (aceite: boolean) => void;
  /** Shown after a submit attempt without ticking it. */
  erro?: string | null;
};

/**
 * The tick before creating an account: age and the terms and privacy policy, which open right here. Never ticked by
 * default, and the account can't be created without it.
 */
export function ConsentimentoTermos({ aceite, onMudar, erro }: ConsentimentoTermosProps) {
  const router = useRouter();
  const theme = useTheme();
  const abrir = (documento: 'termos' | 'privacidade') =>
    router.push({ pathname: '/legal/[documento]', params: { documento } });

  return (
    <View style={styles.bloco}>
      <Pressable
        onPress={() => onMudar(!aceite)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: aceite }}
        accessibilityLabel={`Tenho ${IDADE_MINIMA} anos ou mais e aceito os termos de utilização e a política de privacidade`}
        hitSlop={6}
        style={styles.linha}>
        <View
          testID="caixa-consentimento"
          style={[
            styles.caixa,
            {
              borderColor: erro ? theme.danger : aceite ? theme.accent : theme.borderStrong,
              backgroundColor: aceite ? theme.accent : theme.backgroundElement,
            },
          ]}>
          {aceite ? <Icon name={icons.checkInFeito} size={16} strokeWidth={3} color={theme.accentText} /> : null}
        </View>
        <ThemedText type="small" style={styles.texto}>
          {`Tenho ${IDADE_MINIMA} anos ou mais e aceito os termos de utilização e a política de privacidade.`}
        </ThemedText>
      </Pressable>
      {/* The documents open from their own links, outside the checkbox: a tap on the sentence ticks the box, and a
          screen reader reaches each link on its own. */}
      <View style={styles.ligacoes}>
        <Pressable onPress={() => abrir('termos')} accessibilityRole="link" hitSlop={8}>
          <ThemedText type="small" themeColor="accentInk" style={styles.ligacao}>
            Ler os termos
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => abrir('privacidade')} accessibilityRole="link" hitSlop={8}>
          <ThemedText type="small" themeColor="accentInk" style={styles.ligacao}>
            Ler a política de privacidade
          </ThemedText>
        </Pressable>
      </View>
      {erro ? (
        <ThemedText type="small" style={{ color: theme.dangerText }} accessibilityLiveRegion="polite">
          {erro}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: {
    gap: Spacing.one,
  },
  ligacoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
    paddingLeft: 26 + Spacing.twoAndHalf,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.twoAndHalf,
    paddingVertical: Spacing.one,
  },
  caixa: {
    width: 26,
    height: 26,
    borderRadius: Radius.field / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  ligacao: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: 700,
    textDecorationLine: 'underline',
  },
});
