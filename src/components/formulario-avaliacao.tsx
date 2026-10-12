import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useJogosAQueFoste } from '@/hooks/use-jogos-a-que-foste';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarDia } from '@/lib/datas';
import { estadoDoJogo } from '@/lib/jogos';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import type { Nota } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { CampoTexto } from '@/ui/campo-texto';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { SeletorNota } from '@/ui/seletor-nota';
import { ThemedText } from '@/ui/themed-text';

const MAX_COMENTARIO = 280;

/** Formulário da avaliação de uma visita, usado no painel da ficha do jogo e do perfil. */
export function FormularioAvaliacao({ jogoId }: { jogoId: string }) {
  const router = useRouter();
  const theme = useTheme();
  const agora = useNow();
  const { avaliacaoDoJogo, guardarAvaliacao } = useAppState();
  const { foste, aCarregar } = useJogosAQueFoste();

  const existente = avaliacaoDoJogo(jogoId);
  const [estadio, setEstadio] = useState<Nota | null>(existente?.estadio ?? null);
  const [ambiente, setAmbiente] = useState<Nota | null>(existente?.ambiente ?? null);
  const [acessos, setAcessos] = useState<Nota | null>(existente?.acessos ?? null);
  const [comentario, setComentario] = useState(existente?.comentario ?? '');

  const jogo = obterJogo(jogoId);
  const casa = jogo ? obterClube(jogo.casaId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  const venue = jogo ? obterEstadio(jogo.estadioId) : undefined;
  const podeGuardar = estadio !== null && ambiente !== null && acessos !== null;

  function guardar() {
    if (!jogo || estadio === null || ambiente === null || acessos === null) return;
    guardarAvaliacao({
      jogoId: jogo.id,
      estadioId: jogo.estadioId,
      dataVisita: jogo.inicio,
      estadio,
      ambiente,
      acessos,
      comentario: comentario.trim(),
    });
    // Rating never gives a stamp (only being at the stadium does), so no stamp sound here.
    router.back();
  }

  function renderConteudo() {
    if (!jogo || !casa || !fora) {
      return (
        <EmptyState
          icon={icons.naoEncontrado}
          title="Jogo não encontrado"
          message="Este jogo fugiu-nos. Tenta outra vez a partir da ficha do jogo."
          action={{ label: 'Fechar', onPress: () => router.back() }}
        />
      );
    }

    if (estadoDoJogo(jogo, agora) !== 'terminado') {
      return (
        <EmptyState
          icon={icons.horario}
          title="Ainda não podes avaliar"
          message="Calma, o árbitro ainda não apitou para o fim."
          action={{ label: 'Fechar', onPress: () => router.back() }}
        />
      );
    }

    // Only who stamped the stadium went to the game, and only they rate it.
    if (!aCarregar && !foste(jogo.id)) {
      return (
        <EmptyState
          icon={icons.estadio}
          title="Só avalia quem foi"
          message="Para avaliar, faz o carimbo no estádio no dia do jogo: a app confirma que lá estás."
          action={{ label: 'Fechar', onPress: () => router.back() }}
        />
      );
    }

    return (
      <>
        <View style={styles.cabecalho}>
          <ThemedText type="eyebrow" themeColor="accentInk">
            {`Visita de ${formatarDia(new Date(jogo.inicio)).toLowerCase()}`}
          </ThemedText>
          <ThemedText type="subtitle" accessibilityRole="header">
            {existente ? 'Editar avaliação' : 'Avaliar visita'}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {`${casa.nomeCurto} x ${fora.nomeCurto}${venue ? ` · ${venue.nome}` : ''}`}
          </ThemedText>
        </View>

        <Card style={styles.notas}>
          <SeletorNota
            label="Estádio"
            description="Conforto, limpeza e visibilidade"
            value={estadio}
            onChange={setEstadio}
          />
          <SeletorNota
            label="Ambiente"
            description="Adeptos, cânticos e emoção"
            value={ambiente}
            onChange={setAmbiente}
          />
          <SeletorNota
            label="Acessos"
            description="Chegar, entrar e sair do estádio"
            value={acessos}
            onChange={setAcessos}
          />
        </Card>

        <CampoTexto
          label="Comentário"
          placeholder="Conta lá: o que correu bem ou mal? (opcional)"
          value={comentario}
          onChangeText={setComentario}
          maxLength={MAX_COMENTARIO}
        />

        <Button
          label={existente ? 'Guardar alterações' : 'Guardar avaliação'}
          icon={icons.estrela}
          disabled={!podeGuardar}
          onPress={guardar}
        />
        {podeGuardar ? null : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centro}>
            Falta dar nota às três categorias.
          </ThemedText>
        )}
      </>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.conteudo}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      {renderConteudo()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Spacing.four,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  cabecalho: {
    gap: Spacing.one,
  },
  notas: {
    gap: Spacing.four,
    paddingVertical: 20,
  },
  centro: {
    textAlign: 'center',
  },
});
