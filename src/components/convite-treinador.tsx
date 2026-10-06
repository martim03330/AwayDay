import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useMyProfile, useUpdateMessagePreferences } from '@/features/profile/hooks/useMyProfile';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/session';
import { useAppState } from '@/state/app-state';
import { Icon, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

/** «Agora não» is remembered on this phone, so the question doesn't come back every time. */
const CHAVE_RECUSADO = 'awayday-treinador-recusado-v1';

/**
 * Where the coach's tip lives, before anyone said yes to it. The tips are written by a third-party AI from facts about
 * the person's match days, so they only start with an explicit yes (Apple 5.1.2(i), RGPD). Says what goes where.
 */
export function ConviteTreinador() {
  const theme = useTheme();
  const { modoDemo } = useAppState();
  const sessao = useUserId();
  // Demo mode leaves the real account alone: no question, no write.
  const userId = modoDemo ? null : sessao;
  const perfil = useMyProfile(userId);
  const guardar = useUpdateMessagePreferences(userId);
  const [recusado, setRecusado] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CHAVE_RECUSADO)
      .then((valor) => setRecusado(valor === '1'))
      .catch(() => setRecusado(false));
  }, []);

  if (!userId || !perfil.data || perfil.data.nudgesEnabled || recusado !== false) return null;

  function recusar() {
    setRecusado(true);
    void AsyncStorage.setItem(CHAVE_RECUSADO, '1').catch(() => undefined);
  }

  function aceitar() {
    guardar.mutate(
      { nudgesEnabled: true },
      { onError: () => Alert.alert('Não ficou ligado', 'Verifica a ligação e tenta outra vez.') }
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.topo}>
        <View style={[styles.azulejo, { backgroundColor: theme.highlight }]}>
          <Icon name={icons.treinador} size={22} color={theme.highlightText} />
        </View>
        <View style={styles.corpo}>
          <ThemedText type="eyebrow" themeColor="accentInk">
            Dica do treinador
          </ThemedText>
          <ThemedText style={styles.titulo}>Queres uma dica para cada dia de jogo?</ThemedText>
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        É escrita por IA (Claude, da Anthropic) com o teu clube, os teus jogos e o que fazes na app.
        Nunca com o teu nome nem o email. Desligas quando quiseres nas Definições.
      </ThemedText>
      <View style={styles.botoes}>
        <LinkTexto neutro label="Agora não" onPress={recusar} />
        <LinkTexto
          label={guardar.isPending ? 'A ligar…' : 'Quero dicas'}
          disabled={guardar.isPending}
          onPress={aceitar}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: 14,
    borderRadius: 18,
    borderCurve: 'continuous',
    boxShadow: `0 0 0 2px ${Colors.highlight}, 0 10px 24px rgba(8, 40, 22, 0.2)`,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  titulo: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 700,
  },
  botoes: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
});
