import { useLocalSearchParams, useRouter } from 'expo-router';

import { BoleiasDoJogo } from '@/components/boleias-do-jogo';
import { obterJogo } from '@/mocks/jogos';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';

/** As boleias deste jogo: quem leva quem, e a volta depois do apito. */
export default function BoleiasScreen() {
  const router = useRouter();
  const { jogoId } = useLocalSearchParams<{ jogoId?: string }>();
  const jogo = jogoId ? obterJogo(jogoId) : undefined;

  if (!jogo) {
    return (
      <Screen>
        <EmptyState
          icon={icons.carro}
          title="Jogo não encontrado"
          message="Volta aos jogos e tenta outra vez."
          action={{ label: 'Voltar aos jogos', onPress: () => router.replace('/jogos') }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <BoleiasDoJogo jogo={jogo} />
    </Screen>
  );
}
