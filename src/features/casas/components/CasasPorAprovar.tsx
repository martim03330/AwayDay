import { Alert, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useDecideSupportersClub, usePendingSupportersClubs } from '@/features/casas/hooks/useCasas';
import { mensagemDaGestao } from '@/features/casas/mensagens';
import type { SupportersClub } from '@/features/casas/types';
import { vibrarErro, vibrarSucesso } from '@/lib/vibrar';
import { obterClube } from '@/mocks/clubes';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

/**
 * The Casas waiting for a decision, for administrators: confirm with the Casa (its official email or a phone call),
 * then approve or suspend. Only rendered for admins; the hook stays idle otherwise, since the same query would also
 * return a manager's own pending Casa.
 */
export function CasasPorAprovar({ isAdmin }: { isAdmin: boolean }) {
  const pendentes = usePendingSupportersClubs(isAdmin);
  const decidir = useDecideSupportersClub();

  if (!isAdmin) return null;

  function decidirSobre(casa: SupportersClub, status: 'verified' | 'suspended') {
    decidir.mutate(
      { id: casa.id, status },
      {
        onSuccess: () => vibrarSucesso(),
        onError: (problema) => {
          vibrarErro();
          Alert.alert('Não deu', mensagemDaGestao(problema));
        },
      }
    );
  }

  function suspender(casa: SupportersClub) {
    Alert.alert(`Suspender ${casa.name}?`, 'A Casa deixa de aparecer e não pode publicar viagens.', [
      { text: 'Deixa estar', style: 'cancel' },
      { text: 'Suspender', style: 'destructive', onPress: () => decidirSobre(casa, 'suspended') },
    ]);
  }

  const lista = pendentes.data ?? [];

  return (
    <>
      <SectionHeader title="Casas por aprovar" contagem={lista.length > 0 ? lista.length : undefined} />
      {pendentes.isLoading ? (
        <SkeletonCard lines={2} />
      ) : lista.length === 0 ? (
        <ThemedText themeColor="textSecondary">Nenhuma Casa à espera.</ThemedText>
      ) : (
        lista.map((casa) => {
          const clube = obterClube(casa.clubId);
          return (
            <Card key={casa.id} style={styles.cartao}>
              <ThemedText type="smallBold">{casa.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[clube?.nomeCurto, casa.municipalityName].filter(Boolean).join(' · ')}
              </ThemedText>
              <View style={styles.botoes}>
                <View style={styles.botao}>
                  <Button
                    label="Aprovar"
                    disabled={decidir.isPending}
                    onPress={() => decidirSobre(casa, 'verified')}
                  />
                </View>
                <View style={styles.botao}>
                  <Button
                    label="Suspender"
                    variant="secondary"
                    disabled={decidir.isPending}
                    onPress={() => suspender(casa)}
                  />
                </View>
              </View>
            </Card>
          );
        })
      )}
    </>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.two,
  },
  botoes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  botao: {
    flex: 1,
  },
});
