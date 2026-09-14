import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { plural } from '@/lib/formatos';
import type { AtividadeLocal } from '@/state/armazenamento-local';
import { useAppState } from '@/state/app-state';

/** "2 avaliações, 3 visitas a tascos e 1 foto". */
function resumo(atividade: AtividadeLocal) {
  const partes = [
    atividade.avaliacoes.length > 0 ? plural(atividade.avaliacoes.length, 'avaliação', 'avaliações') : null,
    atividade.visitas.length > 0
      ? plural(atividade.visitas.length, 'visita a um tasco', 'visitas a tascos')
      : null,
    Object.keys(atividade.notasTascos).length > 0
      ? plural(Object.keys(atividade.notasTascos).length, 'nota a um tasco', 'notas a tascos')
      : null,
    atividade.fotos.length > 0 ? plural(atividade.fotos.length, 'foto', 'fotos') : null,
    atividade.medicoes.length > 0
      ? plural(atividade.medicoes.length, 'medição do barulhómetro', 'medições do barulhómetro')
      : null,
  ].filter((parte): parte is string => parte !== null);

  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

/**
 * The first time someone signs in on a phone that has activity from before the account, asks whether to bring it
 * in. Nothing is merged without asking, so another person's activity on a shared phone never ends up in the account.
 * Draws nothing.
 */
export function JuntarAtividade() {
  const { atividadeParaJuntar, juntarAtividadeAConta, naoJuntarAtividade } = useAppState();
  const perguntado = useRef(false);

  useEffect(() => {
    if (!atividadeParaJuntar || perguntado.current) return;
    perguntado.current = true;

    const semMedicoes =
      atividadeParaJuntar.medicoes.length > 0
        ? '\n\nAs medições do barulhómetro ficam só neste telemóvel: a conta só aceita medições feitas durante o jogo.'
        : '';

    Alert.alert(
      'Juntar à tua conta?',
      `Neste telemóvel tens ${resumo(atividadeParaJuntar)} de antes de entrares. Queres juntar à tua conta?${semMedicoes}`,
      [
        { text: 'Agora não', style: 'cancel', onPress: naoJuntarAtividade },
        {
          text: 'Juntar',
          onPress: () =>
            void juntarAtividadeAConta().then(({ falhados }) => {
              if (falhados > 0) {
                Alert.alert(
                  'Faltou juntar uma parte',
                  `${plural(falhados, 'registo não foi aceite', 'registos não foram aceites')} pela conta (por exemplo, jogos que ainda não começaram). Continuam guardados neste telemóvel.`
                );
              }
            }),
        },
      ],
      { cancelable: false }
    );
  }, [atividadeParaJuntar, juntarAtividadeAConta, naoJuntarAtividade]);

  return null;
}
