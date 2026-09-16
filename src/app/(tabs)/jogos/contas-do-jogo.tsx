import { useLocalSearchParams, useRouter } from 'expo-router';

import { ContasDaViagem } from '@/components/contas-da-viagem';
import { obterJogo } from '@/mocks/jogos';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

/** As contas deste jogo onde entras, e por onde abrir umas novas. */
export default function ContasDoJogoScreen() {
  const router = useRouter();
  const { jogoId } = useLocalSearchParams<{ jogoId?: string }>();
  const jogo = jogoId ? obterJogo(jogoId) : undefined;

  if (!jogo) {
    return (
      <Screen>
        <EmptyState
          icon={icons.preco}
          title="Jogo não encontrado"
          message="Volta aos jogos e tenta outra vez."
          action={{ label: 'Voltar aos jogos', onPress: () => router.replace('/jogos') }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader title="Contas da viagem" />
      <ContasDaViagem jogo={jogo} />
      <ThemedText type="small" themeColor="textMuted">
        Umas contas abrem-se a partir de uma boleia (entra a malta do carro), de um grupo teu, ou do
        zero. A partir daí são das pessoas que lá estão.
      </ThemedText>
    </Screen>
  );
}
