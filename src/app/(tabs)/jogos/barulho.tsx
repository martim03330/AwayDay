import { useLocalSearchParams, useRouter } from 'expo-router';

import { BarulhometroCard } from '@/components/barulhometro-card';
import { useNow } from '@/hooks/use-now';
import { obterJogo } from '@/mocks/jogos';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';

/** O barulhómetro deste jogo: só mede quem está lá, e por isso vive numa página onde se fica. */
export default function BarulhoScreen() {
  const router = useRouter();
  const { jogoId } = useLocalSearchParams<{ jogoId?: string }>();
  const agora = useNow(30 * 1000);
  const jogo = jogoId ? obterJogo(jogoId) : undefined;

  if (!jogo) {
    return (
      <Screen>
        <EmptyState
          icon={icons.som}
          title="Jogo não encontrado"
          message="Volta aos jogos e tenta outra vez."
          action={{ label: 'Voltar aos jogos', onPress: () => router.replace('/jogos') }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <BarulhometroCard jogo={jogo} agora={agora} />
    </Screen>
  );
}
