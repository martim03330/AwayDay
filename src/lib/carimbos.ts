/**
 * Quando é que se pode carimbar um estádio: à volta do jogo, estando lá.
 *
 * A mesma janela está no servidor (`stadium_stamp_window`), que é quem decide — isto serve para a app só mostrar o
 * botão quando ele faz sentido.
 */

const HORA_MS = 60 * 60 * 1000;

/** Abre quatro horas antes do apito: dá tempo para o almoço, o tasco e a fila. */
export const ABRE_ANTES_HORAS = 4;
/** Fecha cinco horas depois: o jogo, o trânsito à saída e o que vier a seguir. */
export const FECHA_DEPOIS_HORAS = 5;

export function janelaDoCarimbo(inicioIso: string) {
  const apito = Date.parse(inicioIso);
  return {
    abre: new Date(apito - ABRE_ANTES_HORAS * HORA_MS),
    fecha: new Date(apito + FECHA_DEPOIS_HORAS * HORA_MS),
  };
}

export function podeCarimbar(inicioIso: string, agora: number) {
  const { abre, fecha } = janelaDoCarimbo(inicioIso);
  return agora >= abre.getTime() && agora <= fecha.getTime();
}
