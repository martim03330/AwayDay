import * as Device from 'expo-device';
import { launchCameraAsync, requestCameraPermissionsAsync } from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { suggestPlacePhoto, SuggestionRefused } from '@/features/places/api';
import { useUserId } from '@/lib/session';
import type { Local } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { LinkTexto } from '@/ui/link-texto';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** Fans complete a tasco: suggest a dish or send a photo. Both wait for approval before anyone else sees them. */
export function AjudarTasco({ local }: { local: Local }) {
  const router = useRouter();
  const userId = useUserId();
  const [aEnviarFoto, setAEnviarFoto] = useState(false);

  async function enviarFoto() {
    if (!userId || aEnviarFoto) return;
    if (!Device.isDevice) {
      Alert.alert(
        'Este aparelho não tem câmara',
        'Experimenta num telemóvel para enviar uma foto do tasco.'
      );
      return;
    }
    const permissao = await requestCameraPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Sem câmara', 'Dá acesso à câmara nas definições para enviares uma foto.', [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Abrir definições', onPress: () => void Linking.openSettings() },
      ]);
      return;
    }

    const resultado = await launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    const foto = resultado.canceled ? undefined : resultado.assets[0];
    if (!foto) return;

    setAEnviarFoto(true);
    try {
      await suggestPlacePhoto(userId, local.id, foto.uri, foto.mimeType ?? 'image/jpeg');
      Alert.alert('Obrigado!', 'A foto aparece na ficha do tasco depois de ser confirmada.');
    } catch (erro: unknown) {
      Alert.alert(
        'Não deu para enviar',
        erro instanceof SuggestionRefused
          ? 'Já enviaste muitas fotos hoje. Volta amanhã.'
          : 'Verifica a ligação e tenta outra vez.'
      );
    } finally {
      setAEnviarFoto(false);
    }
  }

  if (!userId) {
    return (
      <Card style={styles.card}>
        <ThemedText themeColor="textSecondary" style={styles.texto}>
          Conheces este tasco? Entra na tua conta para sugerir pratos e enviar fotos.
        </ThemedText>
        <LinkTexto label="Entrar" onPress={() => router.push('/conta/entrar')} />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <ThemedText themeColor="textSecondary" style={styles.texto}>
        Conheces este tasco? Ajuda quem vem a seguir. As sugestões aparecem depois de confirmadas.
      </ThemedText>
      <View style={styles.botoes}>
        <Button
          label="Sugerir um prato"
          icon={icons.especialidade}
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/locais/sugerir-prato', params: { localId: local.id } })
          }
        />
        <Button
          label={aEnviarFoto ? 'A enviar…' : 'Enviar uma foto'}
          icon={icons.camara}
          variant="secondary"
          disabled={aEnviarFoto}
          onPress={() => void enviarFoto()}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  texto: {
    fontSize: 14,
    lineHeight: 20,
  },
  botoes: {
    gap: 8,
  },
});
