import { TripRefused } from '@/features/trips/api';

/** O que dizer quando o servidor recusa alguma coisa nas contas. */
export function mensagemDeRecusaDasContas(erro: unknown) {
  if (!(erro instanceof TripRefused)) return 'Não deu para fazer isso. Tenta outra vez.';
  switch (erro.reason) {
    case 'not_member':
    case 'not_in_ride':
      return 'Já não estás nesta viagem.';
    case 'bad_expense':
      return 'Falta alguma coisa: escreve o que foi e quanto custou.';
    case 'participant_not_member':
    case 'payer_not_member':
      return 'Alguém que escolheste já não está na viagem. Atualiza e tenta outra vez.';
    case 'no_participants':
      return 'Escolhe pelo menos uma pessoa para entrar na despesa.';
    case 'not_yours':
      return 'Isso só pode ser feito por quem esteve nessa despesa ou nesse pagamento.';
    case 'not_in_trip':
      return 'Essa pessoa não está nestas contas.';
    case 'bad_settlement':
      return 'Um pagamento é sempre de uma pessoa para outra, com um valor.';
    case 'ride_expense':
      return 'A despesa da boleia não se apaga: ela acompanha quem vai no carro.';
    case 'cannot_add':
      return 'Só podes acrescentar amigos, malta dos teus grupos ou quem vai no carro.';
    case 'has_money':
      return 'Essa pessoa já tem despesas nestas contas. Apaga-as primeiro, se for engano.';
    case 'last_person':
      return 'Umas contas não ficam sem ninguém.';
    case 'rate_limited':
      return 'Já lançaste muitas despesas hoje. Continua amanhã.';
    default:
      return 'Não deu para fazer isso. Tenta outra vez.';
  }
}
