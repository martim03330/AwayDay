import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { getDemoFixture } from '@/features/fixtures/store';
import { useNow } from '@/hooks/use-now';
import { formatarDiaEHora } from '@/lib/datas';
import { FASES_DIA_DE_JOGO, nomesFase } from '@/lib/relogio';
import { obterClube } from '@/mocks/clubes';
import { JOGOS_DEMO } from '@/mocks/demo';
import type { Jogo } from '@/mocks/tipos';
import { useRelogio } from '@/state/relogio';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

// The sample games live in the demo catalogue, which exists whatever mode is on. (Looking them up in the active
// catalogue at load time found nothing: the real one is active then, and it has no sample games.)
const jogosDemo: Jogo[] = JOGOS_DEMO.flatMap((id) => {
  const jogo = getDemoFixture(id);
  return jogo ? [jogo] : [];
});

function nomeDoJogo(jogo: Jogo) {
  return `${obterClube(jogo.casaId)?.nomeCurto ?? jogo.casaId} x ${obterClube(jogo.foraId)?.nomeCurto ?? jogo.foraId}`;
}

/** Seletor de fase do dia de jogo, escondido no perfil para demos. */
export function ModoDemoCard() {
  const router = useRouter();
  const agora = useNow(1000);
  const { simulacao, simularFase, usarHoraReal } = useRelogio();
  const [jogoId, setJogoId] = useState(simulacao?.jogoId ?? jogosDemo[0]?.id ?? '');
  const jogo = jogosDemo.find((candidato) => candidato.id === jogoId);

  function escolherJogo(novo: Jogo) {
    setJogoId(novo.id);
    if (simulacao) simularFase(novo, simulacao.fase);
  }

  return (
    <Card style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary">
        Para demos: muda a hora da app e vê cada fase do relógio do dia de jogo.
      </ThemedText>
      <ThemedText type="smallBold">
        {`Hora na app: ${formatarDiaEHora(new Date(agora), agora)}${simulacao ? ' (simulada)' : ''}`}
      </ThemedText>

      <ThemedText type="eyebrow" themeColor="textSecondary">
        Jogo
      </ThemedText>
      <View style={styles.chips}>
        {jogosDemo.map((opcao) => (
          <Chip
            key={opcao.id}
            label={nomeDoJogo(opcao)}
            selected={opcao.id === jogoId}
            onPress={() => escolherJogo(opcao)}
            emCartao
          />
        ))}
      </View>

      <ThemedText type="eyebrow" themeColor="textSecondary">
        Fase
      </ThemedText>
      <View style={styles.chips}>
        {FASES_DIA_DE_JOGO.map((fase) => (
          <Chip
            key={fase}
            label={nomesFase[fase]}
            selected={simulacao?.fase === fase}
            onPress={() => {
              if (jogo) simularFase(jogo, fase);
            }}
            emCartao
          />
        ))}
        <Chip label="Hora real" selected={!simulacao} onPress={usarHoraReal} emCartao />
      </View>

      {jogo ? (
        <Button
          label="Abrir ficha do jogo"
          variant="secondary"
          icon={icons.jogos}
          onPress={() => router.push({ pathname: '/jogos/[jogoId]', params: { jogoId: jogo.id } })}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
