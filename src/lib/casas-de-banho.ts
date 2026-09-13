import { formatarDiaEHora, formatarHora, minutosDoDiaEmLisboa } from '@/lib/datas';
import { distanciaEmLinhaRetaKm } from '@/lib/distancia';
import { estadoDoJogo, fimDoJogo } from '@/lib/jogos';
import type { AcessoRestroom, Coordenadas, Jogo, Restroom, TipoRestroom } from '@/mocks/tipos';

/** Fator entre linha reta e caminho a pé, e ritmo a pé: os mesmos usados nos locais. */
const FATOR_A_PE = 1.25;
const METROS_POR_MINUTO = 80;
const HORA_MS = 60 * 60 * 1000;

export const MAX_MINUTOS_WC = 20;

export const nomesTipoWc: Record<TipoRestroom, string> = {
  publica: 'WC público',
  tasco: 'WC de tasco',
  estadio: 'WC do estádio',
};

export const nomesAcesso: Record<AcessoRestroom, string> = {
  livre: 'Acesso livre',
  clientes: 'Só para clientes',
  bilhete: 'Só com bilhete',
};

export function distanciaAPe(origem: Coordenadas, destino: Coordenadas) {
  const metros = Math.round(distanciaEmLinhaRetaKm(origem, destino) * 1000 * FATOR_A_PE);
  return { metros, minutos: Math.max(1, Math.round(metros / METROS_POR_MINUTO)) };
}

function horaEmMinutos(hora: string) {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}

export type EstadoAbertura = { aberta: boolean; texto: string };

/** Se a casa de banho está aberta agora (hora de Lisboa) e o texto a mostrar. */
export function estadoDeAbertura(
  wc: Restroom,
  agora: Date,
  jogos: readonly Jogo[]
): EstadoAbertura {
  const { horario } = wc;

  if (horario.tipo === 'sempre') return { aberta: true, texto: 'Aberta 24 h' };

  if (horario.tipo === 'intervalo') {
    const minutos = minutosDoDiaEmLisboa(agora);
    const abre = horaEmMinutos(horario.abre);
    const fecha = horaEmMinutos(horario.fecha);
    const aberta =
      fecha > abre ? minutos >= abre && minutos < fecha : minutos >= abre || minutos < fecha;
    return aberta
      ? { aberta, texto: `Aberta até às ${horario.fecha}` }
      : { aberta, texto: `Fechada · abre às ${horario.abre}` };
  }

  const agoraMs = agora.getTime();
  const proximo = jogos
    .filter((jogo) => jogo.estadioId === wc.estadioId && estadoDoJogo(jogo, agoraMs) !== 'terminado')
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0];

  if (!proximo) return { aberta: false, texto: 'Fechada · só abre em dias de jogo' };

  const abreMs = Date.parse(proximo.inicio) - horario.abreHorasAntes * HORA_MS;
  if (agoraMs >= abreMs) {
    return { aberta: true, texto: `Aberta até ao fim do jogo (${formatarHora(fimDoJogo(proximo))})` };
  }
  return {
    aberta: false,
    texto: `Fechada · abre ${formatarDiaEHora(new Date(abreMs)).toLowerCase()}`,
  };
}

/** Casas de banho a menos de 20 min a pé da origem, da mais perto para a mais longe. */
export function casasDeBanhoPerto(origem: Coordenadas, casasDeBanho: readonly Restroom[]) {
  return casasDeBanho
    .map((wc) => ({ wc, ...distanciaAPe(origem, wc.coordenadas) }))
    .filter(({ minutos }) => minutos < MAX_MINUTOS_WC)
    .sort((a, b) => a.metros - b.metros);
}
