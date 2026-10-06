import { Alert } from 'react-native';

import { sharePlaceWithGroup } from '@/features/groups/api';
import { useMyGroupInbox, useRefreshGroups } from '@/features/groups/hooks/useGroups';
import { useMyProfile, useUpdateShareCheckins } from '@/features/profile/hooks/useMyProfile';
import { useUserId } from '@/lib/session';

/**
 * Depois do primeiro check-in com conta, pergunta **uma vez** se a malta dos grupos deve passar a saber sozinha em que
 * tasco a pessoa fez check-in. A resposta fica no perfil e muda-se nas Definições. Sem resposta, não se partilha
 * nada — a localização de alguém nunca vai para outros sem essa pessoa o dizer.
 *
 * Dizer que sim avisa logo os grupos deste check-in (os seguintes são avisados pelo servidor).
 */
export function usePerguntarPartilhaDoCheckIn() {
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  const inbox = useMyGroupInbox(userId !== null);
  const partilha = useUpdateShareCheckins(userId);
  const refrescar = useRefreshGroups();

  return {
    /** Já disse que sim: o cartão «Estás aqui? Diz à malta» deixa de ser preciso. */
    automatica: perfil.data?.shareCheckinsWithGroups === true,
    depoisDoCheckIn(placeId: string) {
      if (!userId || !perfil.data || perfil.data.shareCheckinsWithGroups !== null) return;
      const grupos = inbox.data ?? [];
      if (grupos.length === 0) return;
      const quem =
        grupos.length === 1
          ? `o grupo «${grupos[0].name}» fica`
          : `os teus ${grupos.length} grupos ficam`;
      Alert.alert(
        'Dizer à malta onde estás?',
        `Sempre que fizeres check-in num tasco, ${quem} a saber em que tasco estás — só o nome do tasco. Mudas quando quiseres nas Definições.`,
        [
          { text: 'Agora não', style: 'cancel', onPress: () => partilha.mutate(false) },
          {
            text: 'Sim, dizer sempre',
            onPress: () => {
              partilha.mutate(true);
              void Promise.all(
                grupos.map((grupo) => sharePlaceWithGroup(grupo.id, placeId).catch(() => undefined))
              ).then(() => refrescar());
            },
          },
        ]
      );
    },
  };
}
