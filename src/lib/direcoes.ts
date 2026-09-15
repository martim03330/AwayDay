import { Linking, Platform } from 'react-native';

import type { Coordenadas } from '@/mocks/tipos';

export type ModoDirecoes = 'a-pe' | 'carro';

/** Map app link with directions to a point: Apple Maps on iOS, Google Maps elsewhere. No API, no key. */
export function urlDirecoes(
  destino: Coordenadas,
  modo: ModoDirecoes,
  plataforma: string = Platform.OS
) {
  const ponto = `${destino.latitude},${destino.longitude}`;
  if (plataforma === 'ios') {
    return `https://maps.apple.com/?daddr=${ponto}&dirflg=${modo === 'a-pe' ? 'w' : 'd'}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${ponto}&travelmode=${modo === 'a-pe' ? 'walking' : 'driving'}`;
}

/** Opens directions in the phone's map app. The route starts wherever the phone is. */
export function abrirDirecoes(destino: Coordenadas, modo: ModoDirecoes) {
  void Linking.openURL(urlDirecoes(destino, modo)).catch(() => undefined);
}
