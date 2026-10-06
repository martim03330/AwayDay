import type { useRouter } from 'expo-router';
import { Alert } from 'react-native';

type Router = ReturnType<typeof useRouter>;

/**
 * One invite per game in each group. When someone tries a second one, say so with a smile and offer the one that
 * already exists (when we know which).
 */
export function avisarConviteRepetido(
  router: Router,
  grupo: { id: string; name: string },
  planoId: string | null,
  depoisDeAbrir?: () => void
) {
  const botoes: Parameters<typeof Alert.alert>[2] = [{ text: 'Deixa estar', style: 'cancel' }];
  if (planoId) {
    botoes.push({
      text: 'Ver o convite',
      onPress: () => {
        depoisDeAbrir?.();
        router.push({
          pathname: '/grupos/[grupoId]/plano/[planoId]',
          params: { grupoId: grupo.id, planoId },
        });
      },
    });
  }
  Alert.alert(
    'Calma, que este jogo já está convocado',
    `A malta do «${grupo.name}» já tem convite para este jogo. Dois convites para o mesmo jogo é como dois árbitros em campo: só dá confusão.`,
    botoes
  );
}
