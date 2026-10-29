import { useLocalSearchParams, useRouter } from 'expo-router';

import { ViagemDaCasa } from '@/features/casas/components/ViagemDaCasa';
import { BotaoMais, useModeracao } from '@/features/moderation/components/Moderacao';
import { Screen } from '@/ui/screen';

/** A Casa's trip, from a fan's side: opened from the game page, the Casa's page or a notification. */
export default function ViagemDaCasaScreen() {
  const { viagemId } = useLocalSearchParams<{ viagemId?: string }>();
  const router = useRouter();
  const moderacao = useModeracao();

  return (
    <Screen>
      {moderacao.elemento}
      {viagemId ? (
        <ViagemDaCasa
          tripId={viagemId}
          onAbrirCasa={(casaId) => router.push({ pathname: '/casa/[casaId]', params: { casaId } })}
          renderMais={(nome) => (
            <BotaoMais
              nome={nome}
              onPress={() => moderacao.abrirConteudo({ kind: 'club_trip', targetId: viagemId, nome })}
            />
          )}
        />
      ) : null}
    </Screen>
  );
}
