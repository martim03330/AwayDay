/**
 * Todas as datas da app são apresentadas no fuso de Lisboa, independentemente do fuso do telemóvel.
 */

const FUSO = 'Europe/Lisbon';
const IDIOMA = 'pt-PT';
const MINUTO_MS = 60 * 1000;
const DIA_MS = 24 * 60 * MINUTO_MS;

const formatoPartes = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const formatoHora = new Intl.DateTimeFormat(IDIOMA, {
  timeZone: FUSO,
  hour: '2-digit',
  minute: '2-digit',
});

const formatoDia = new Intl.DateTimeFormat(IDIOMA, {
  timeZone: FUSO,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const formatoData = new Intl.DateTimeFormat(IDIOMA, {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function partesEmLisboa(data: Date) {
  const partes = formatoPartes.formatToParts(data);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((parte) => parte.type === tipo)?.value);

  return {
    ano: valor('year'),
    mes: valor('month'),
    dia: valor('day'),
    hora: valor('hour'),
    minuto: valor('minute'),
  };
}

/** Minutos de avanço de Lisboa face a UTC nesse instante (0 no inverno, 60 no verão). */
function desvioDeLisboaEmMinutos(data: Date) {
  const { ano, mes, dia, hora, minuto } = partesEmLisboa(data);
  const comoSeFosseUtc = Date.UTC(ano, mes - 1, dia, hora, minuto);
  return Math.round((comoSeFosseUtc - data.getTime()) / MINUTO_MS);
}

/** Instante correspondente a `hora` (HH:MM) em Lisboa, `dias` dias depois do dia (em Lisboa) de `referencia`. */
export function dataEmLisboaAPartirDe(referencia: Date, dias: number, hora: string) {
  const dia = partesEmLisboa(referencia);
  const [horas, minutos] = hora.split(':').map(Number);
  const relogioDeLisboa = Date.UTC(dia.ano, dia.mes - 1, dia.dia + dias, horas, minutos);
  const desvio = desvioDeLisboaEmMinutos(new Date(relogioDeLisboa));
  return new Date(relogioDeLisboa - desvio * MINUTO_MS);
}

/** Instante correspondente a `hora` (HH:MM) em Lisboa, daqui a `dias` dias. */
export function dataEmLisboa(dias: number, hora: string) {
  return dataEmLisboaAPartirDe(new Date(), dias, hora);
}

/** Minutos desde a meia-noite em Lisboa (0–1439). */
export function minutosDoDiaEmLisboa(data: Date) {
  const { hora, minuto } = partesEmLisboa(data);
  return hora * 60 + minuto;
}

/** Chave `AAAA-MM-DD` do dia em Lisboa, útil para agrupar. */
export function chaveDoDia(data: Date) {
  const { ano, mes, dia } = partesEmLisboa(data);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** "12/09/2026" */
export function formatarData(data: Date) {
  return formatoData.format(data);
}

/** "20:30" */
export function formatarHora(data: Date) {
  return formatoHora.format(data);
}

/**
 * "Hoje", "Amanhã", "Ontem" ou "sábado, 19 de setembro".
 * `agora` permite usar a hora simulada do modo demo.
 */
export function formatarDia(data: Date, agora = Date.now()) {
  const chave = chaveDoDia(data);
  if (chave === chaveDoDia(new Date(agora))) return 'Hoje';
  if (chave === chaveDoDia(new Date(agora + DIA_MS))) return 'Amanhã';
  if (chave === chaveDoDia(new Date(agora - DIA_MS))) return 'Ontem';
  return formatoDia.format(data);
}

/** "Hoje às 20:30" ou "sábado, 19 de setembro às 20:30" */
export function formatarDiaEHora(data: Date, agora = Date.now()) {
  return `${formatarDia(data, agora)} às ${formatarHora(data)}`;
}
