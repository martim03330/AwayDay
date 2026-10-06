import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { EstacionamentoEstadio } from '@/components/estacionamento-estadio';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { eJogoGrande } from '@/lib/classicos';
import { abrirDirecoes } from '@/lib/direcoes';
import { estadoDoJogo } from '@/lib/jogos';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { Button } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { ThemedText } from '@/ui/themed-text';

/** Chegar ao estádio e deixar o carro: a hora de sair, o caminho e os parques. */
export default function ChegarScreen() {
  const router = useRouter();
  const { jogoId } = useLocalSearchParams<{ jogoId?: string }>();
  const agora = useNow(60 * 1000);

  const jogo = jogoId ? obterJogo(jogoId) : undefined;
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;

  if (!jogo || !estadio) {
    return (
      <Screen>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Jogo não encontrado"
          message="Volta aos jogos e tenta outra vez."
          action={{ label: 'Voltar aos jogos', onPress: () => router.replace('/jogos') }}
        />
      </Screen>
    );
  }

  const aDecorrer = estadoDoJogo(jogo, agora) === 'a-decorrer';

  // The native header already says «Chegar e estacionar»: the screen opens straight on the one action.
  return (
    <Screen>
      <Button
        label={aDecorrer ? 'Abrir o caminho de volta no mapa' : 'Abrir o caminho no mapa'}
        icon={icons.rota}
        onPress={() => abrirDirecoes(estadio.coordenadas, 'carro')}
      />
      <ThemedText type="small" themeColor="textMuted" style={styles.ajuda}>
        Abre no mapa do telemóvel, com o trânsito.
      </ThemedText>

      {/* Draws its own «Estacionamento» title, and hides it while there is nothing to show. */}
      <EstacionamentoEstadio
        estadioId={estadio.id}
        jogoGrande={eJogoGrande(jogo)}
        inicio={jogo.inicio}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  ajuda: {
    marginTop: -Spacing.two,
    textAlign: 'center',
  },
});
