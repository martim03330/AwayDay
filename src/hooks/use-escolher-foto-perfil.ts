import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
} from 'expo-image-picker';
import { Alert, Linking, Platform } from 'react-native';

export type FotoEscolhida = { uri: string; mimeType: string };

/**
 * A profile photo from the camera or the gallery, cropped square. Resolves `null` when the person gives up or the
 * camera is not allowed (after explaining how to allow it). Used by the profile and by the introduction.
 */
export function useEscolherFotoPerfil() {
  return async function escolher(daCamara: boolean): Promise<FotoEscolhida | null> {
    if (daCamara) {
      if (Platform.OS === 'web') {
        Alert.alert('Sem câmara', 'Tira a foto no telemóvel, ou escolhe uma da galeria.');
        return null;
      }
      const permissao = await requestCameraPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert('Sem câmara', 'Dá acesso à câmara nas definições para tirares a foto.', [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Abrir definições', onPress: () => void Linking.openSettings() },
        ]);
        return null;
      }
    }

    const opcoes = { mediaTypes: ['images' as const], allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.7 };
    const resultado = daCamara ? await launchCameraAsync(opcoes) : await launchImageLibraryAsync(opcoes);
    const foto = resultado.canceled ? undefined : resultado.assets[0];
    return foto ? { uri: foto.uri, mimeType: foto.mimeType ?? 'image/jpeg' } : null;
  };
}
