import * as Device from 'expo-device';
import { CameraType, launchCameraAsync, requestCameraPermissionsAsync } from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

import { contextoDaFoto } from '@/lib/album';
import { jogos } from '@/mocks/jogos';
import { obterLocal } from '@/mocks/locais';
import type { Missao } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { useRelogio } from '@/state/relogio';
import { useSons } from '@/state/sons';

/** What the camera needs from a mission: the mocks' missions and the server's both fit. */
type MissaoComFoto = Pick<Missao, 'id' | 'fotoComOutraPessoa'>;

/**
 * Foto de prova de uma missão. Só câmara, nunca a galeria: a prova é tirada na hora.
 * Num aparelho sem câmara (o simulador) pode usar-se uma foto de exemplo, que nunca fica verificada.
 */
export function useTirarFoto() {
  const { desvioMs } = useRelogio();
  const { visitasLocais, adicionarFoto } = useAppState();
  const { tocarCarimbo } = useSons();

  function guardar(missao: MissaoComFoto, uri: string | null, mimeType: string | null = null) {
    const agora = Date.now() + desvioMs;
    const contexto = contextoDaFoto({ agora, jogos, visitas: visitasLocais, obterLocal });
    const exemplo = uri === null;
    adicionarFoto({
      missaoId: missao.id,
      uri,
      tiradaEm: new Date(agora).toISOString(),
      ...contexto,
      verificada: contexto.verificada && !exemplo,
      exemplo,
      mimeType,
    });
    // Resposta direta ao disparo da câmara; só toca com os sons ligados.
    tocarCarimbo();
  }

  function oferecerFotoDeExemplo(missao: MissaoComFoto) {
    Alert.alert(
      'Este aparelho não tem câmara',
      'O simulador não tira fotos. Para a demo, podes usar uma foto de exemplo: a missão fecha, mas a foto fica por verificar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Usar foto de exemplo', onPress: () => guardar(missao, null) },
      ]
    );
  }

  async function abrirCamara(missao: MissaoComFoto) {
    if (!Device.isDevice) {
      oferecerFotoDeExemplo(missao);
      return;
    }

    const permissao = await requestCameraPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert(
        'Sem câmara, sem prova',
        'As missões fecham com uma foto tirada na hora. Dá acesso à câmara nas definições.',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Abrir definições', onPress: () => void Linking.openSettings() },
        ]
      );
      return;
    }

    try {
      const resultado = await launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        cameraType: missao.fotoComOutraPessoa ? CameraType.front : CameraType.back,
      });
      const foto = resultado.canceled ? undefined : resultado.assets[0];
      if (foto) guardar(missao, foto.uri, foto.mimeType ?? null);
    } catch {
      Alert.alert('A câmara não abriu', 'Tenta outra vez daqui a nada.');
    }
  }

  return function tirarFoto(missao: MissaoComFoto) {
    if (!missao.fotoComOutraPessoa) {
      void abrirCamara(missao);
      return;
    }
    Alert.alert(
      'Primeiro, pede autorização',
      'Só fotografas quem disser que sim. Cada um com a sua camisola, sem trocas nem contacto.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Já pedi, abrir câmara', onPress: () => void abrirCamara(missao) },
      ]
    );
  };
}
