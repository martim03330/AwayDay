import type { Coordenadas } from '@/mocks/tipos';

const RAIO_DA_TERRA_KM = 6371;
/** Fator médio entre a distância em linha reta e a distância por estrada. */
const FATOR_ESTRADA = 1.2;

function paraRadianos(graus: number) {
  return (graus * Math.PI) / 180;
}

/** Distância em linha reta (fórmula de Haversine). */
export function distanciaEmLinhaRetaKm(origem: Coordenadas, destino: Coordenadas) {
  const deltaLatitude = paraRadianos(destino.latitude - origem.latitude);
  const deltaLongitude = paraRadianos(destino.longitude - origem.longitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(paraRadianos(origem.latitude)) *
      Math.cos(paraRadianos(destino.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 2 * RAIO_DA_TERRA_KM * Math.asin(Math.sqrt(a));
}

/** Velocidade média: cidade até 10 km, estrada nacional até 50 km, autoestrada acima disso. */
function velocidadeMediaKmh(km: number) {
  if (km <= 10) return 30;
  if (km <= 50) return 60;
  return 90;
}

/** Estimativa de viagem de carro, sem trânsito nem rotas reais. */
export function estimarViagemDeCarro(origem: Coordenadas, destino: Coordenadas) {
  const km = distanciaEmLinhaRetaKm(origem, destino) * FATOR_ESTRADA;
  const minutos = Math.max(1, Math.round((km / velocidadeMediaKmh(km)) * 60));
  return { km, minutos };
}
