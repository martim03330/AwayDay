import { useQueryClient } from '@tanstack/react-query';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { rankingsKey } from '@/features/presence/hooks/usePresence';
import { useMyProfile, useUpdateRankingVisibility } from '@/features/profile/hooks/useMyProfile';
import { rankingKey } from '@/features/ranks/hooks/useRanking';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/ui/card';
import { ThemedText } from '@/ui/themed-text';

/**
 * Aparecer ou não nas tabelas com o nome. Vive na aba Ranking (saiu das Definições): é aqui que se percebe o que
 * quer dizer. Desligado, vês a tua posição, mas mais ninguém te vê.
 */
export function AparecerNoRanking({ userId }: { userId: string }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const perfil = useMyProfile(userId);
  const visibilidade = useUpdateRankingVisibility(userId);
  const apareco =
    visibilidade.isPending && visibilidade.variables !== undefined
      ? visibilidade.variables
      : (perfil.data?.showInRankings ?? false);

  function mudar(mostrar: boolean) {
    visibilidade.mutate(mostrar, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: rankingKey(userId) });
        void queryClient.invalidateQueries({ queryKey: rankingsKey(userId) });
      },
      onError: () => Alert.alert('Não deu para guardar', 'Verifica a ligação e tenta outra vez.'),
    });
  }

  return (
    <Card style={styles.cartao}>
      <View style={styles.linha}>
        <ThemedText style={styles.flex}>Aparecer nas tabelas com o meu nome</ThemedText>
        <Switch
          value={apareco}
          onValueChange={mudar}
          disabled={!perfil.data}
          trackColor={{ true: theme.accent, false: theme.border }}
          thumbColor={theme.accentText}
          ios_backgroundColor={theme.border}
          accessibilityLabel="Aparecer nas tabelas com o meu nome"
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {apareco
          ? 'Quem abrir as tabelas vê o teu nome, o clube, o nível e os pontos. Nunca mostramos onde estás.'
          : 'Vês as tabelas e a tua posição, mas mais ninguém te vê nelas.'}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.two,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
