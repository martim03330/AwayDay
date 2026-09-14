import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import type { CoachMessage } from '@/features/coach/types';
import { useTheme } from '@/hooks/use-theme';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type CoachBannerProps = {
  message: CoachMessage | null;
  /** Discreet line while a new message is on its way. */
  loading: boolean;
  /** Inside the green pitch header: a stronger shadow so the card lifts off the grass. */
  sobreRelvado?: boolean;
};

const ANEL_AMARELO = `0 0 0 2px ${Colors.highlight}`;
const SOMBRA_RELVADO = '0 10px 24px rgba(8, 40, 22, 0.2)';

/** "Dica do treinador" at the top of a screen. Nothing at all when there is nothing to say. */
export function CoachBanner({ message, loading, sobreRelvado = false }: CoachBannerProps) {
  const theme = useTheme();
  if (!message && !loading) return null;

  const sombras = [message ? ANEL_AMARELO : null, sobreRelvado ? SOMBRA_RELVADO : null]
    .filter(Boolean)
    .join(', ');

  return (
    <View
      accessible
      accessibilityLabel={message ? `Dica: ${message.body}` : 'A preparar uma dica'}
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, alignItems: message ? 'flex-start' : 'center' },
        sombras ? { boxShadow: sombras } : null,
      ]}>
      {message ? (
        <>
          <View style={[styles.azulejo, { backgroundColor: theme.highlight }]}>
            <Icon name={icons.treinador} size={22} color={theme.highlightText} />
          </View>
          <View style={styles.corpo}>
            <ThemedText type="eyebrow" themeColor="accentInk">
              Dica do treinador
            </ThemedText>
            <ThemedText style={styles.texto}>{message.body}</ThemedText>
          </View>
        </>
      ) : (
        <>
          <View style={[styles.azulejo, { backgroundColor: theme.backgroundSelected }]}>
            <ActivityIndicator size="small" color={theme.accent} />
          </View>
          <ThemedText themeColor="textSecondary" style={[styles.texto, styles.corpo]}>
            A preparar uma dica…
          </ThemedText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  azulejo: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corpo: {
    flex: 1,
    gap: 3,
  },
  texto: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 600,
  },
});
