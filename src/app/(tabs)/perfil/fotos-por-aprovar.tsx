import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { moderatePlacePhoto } from '@/features/places/api';
import { usePendingPlacePhotos, useRefreshPlacePhotos } from '@/features/places/hooks/useFanPhotos';
import { useMyProfile } from '@/features/profile/hooks/useMyProfile';
import { formatarDiaEHora } from '@/lib/datas';
import { useUserId } from '@/lib/session';
import { obterLocal } from '@/mocks/locais';
import { obterEstadio } from '@/mocks/estadios';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

/**
 * Admins approve or reject fans' photos of tascos before anyone else sees them. The question for each photo: does it
 * show this place, inside or out, without identifiable people in focus?
 */
export default function FotosPorAprovarScreen() {
  const router = useRouter();
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  const eAdmin = perfil.data?.isAdmin === true;
  const fotos = usePendingPlacePhotos(eAdmin);
  const atualizar = useRefreshPlacePhotos();
  const [aTratar, setATratar] = useState<string | null>(null);

  async function decidir(id: string, aprovar: boolean) {
    setATratar(id);
    try {
      await moderatePlacePhoto(id, aprovar);
      await atualizar();
    } catch {
      Alert.alert('Não foi possível', 'Verifica a ligação e tenta outra vez.');
    } finally {
      setATratar(null);
    }
  }

  if (perfil.isLoading || fotos.isLoading) {
    return (
      <Screen>
        <SkeletonCard lines={4} />
      </Screen>
    );
  }

  if (!eAdmin) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Só para administradores"
          message="Este ecrã serve para aprovar as fotos que os adeptos enviam."
          action={{ label: 'Voltar', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const lista = fotos.data ?? [];
  if (lista.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={icons.selecionado}
          title="Nada por aprovar"
          message="Quando um adepto enviar uma foto de um tasco, aparece aqui."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">
        Aprova só se a foto mostra este tasco (por fora ou por dentro) e não tem pessoas
        reconhecíveis em destaque.
      </ThemedText>
      {lista.map((foto) => {
        const local = obterLocal(foto.placeId);
        const estadio = local ? obterEstadio(local.estadioId) : undefined;
        return (
          <Card key={foto.id} style={styles.card}>
            <Image
              source={{ uri: foto.url }}
              contentFit="cover"
              style={styles.foto}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`Foto enviada de ${local?.nome ?? 'um tasco'}`}
            />
            <View style={styles.textos}>
              <ThemedText style={styles.nome}>{local?.nome ?? 'Tasco já não listado'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[
                  estadio ? `Perto do ${estadio.nome}` : null,
                  formatarDiaEHora(new Date(foto.createdAt)),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
            </View>
            <View style={styles.botoes}>
              <View style={styles.flex}>
                <Button
                  label="Aprovar"
                  icon={icons.selecionado}
                  disabled={aTratar !== null}
                  onPress={() => void decidir(foto.id, true)}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label="Rejeitar"
                  variant="danger"
                  icon={icons.fechar}
                  disabled={aTratar !== null}
                  onPress={() => void decidir(foto.id, false)}
                />
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  foto: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.button,
  },
  textos: {
    gap: 2,
  },
  nome: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 800,
  },
  botoes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
