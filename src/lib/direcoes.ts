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

export type AppDeMapas = 'apple' | 'google' | 'waze';

const ponto = (coordenadas: Coordenadas) => `${coordenadas.latitude},${coordenadas.longitude}`;

/**
 * A car route in a map app, from `origem` to `destino` through `via` (points along the road the driver picked, so
 * the app does not pick its own). Apple Maps (unified URLs, iOS 18.4+) and Google Maps take the points; Waze's link
 * only takes the destination, so Waze chooses the road itself.
 */
export function urlDoCaminho(
  app: AppDeMapas,
  origem: Coordenadas,
  destino: Coordenadas,
  via: readonly Coordenadas[]
) {
  if (app === 'apple') {
    const params = [
      `source=${ponto(origem)}`,
      ...via.map((paragem) => `waypoint=${ponto(paragem)}`),
      `destination=${ponto(destino)}`,
      'mode=driving',
    ];
    return `https://maps.apple.com/directions?${params.join('&')}`;
  }
  if (app === 'google') {
    const paragens = via.length > 0 ? `&waypoints=${via.map(ponto).join('%7C')}` : '';
    return `https://www.google.com/maps/dir/?api=1&origin=${ponto(origem)}&destination=${ponto(destino)}${paragens}&travelmode=driving`;
  }
  return `https://waze.com/ul?ll=${ponto(destino)}&navigate=yes`;
}

/** Opens the car route in the chosen map app (or its web page when the app is not installed). */
export function abrirCaminho(
  app: AppDeMapas,
  origem: Coordenadas,
  destino: Coordenadas,
  via: readonly Coordenadas[]
) {
  void Linking.openURL(urlDoCaminho(app, origem, destino, via)).catch(() => undefined);
}
