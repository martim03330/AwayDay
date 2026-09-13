import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { estadoDoJogo } from '@/lib/jogos';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import type { Nota } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { CampoTexto } from '@/ui/campo-texto';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { SeletorNota } from '@/ui/seletor-nota';
import { ThemedText } from '@/ui/themed-text';

const MAX_COMENTARIO = 280;

export default function AvaliarScreen() {
  const router = useRouter();
  const theme = useTheme();
  const agora = useNow();
  const { jogoId } = useLocalSearchParams<{ jogoId: string }>();
  const { avaliacoes, guardarAvaliacao } = useAppState();

  const existente = avaliacoes[jogoId];
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
      estadio,
      ambiente,
      acessos,
      comentario: comentario.trim(),
      criadaEm: new Date().toISOString(),
    });
    router.back();
  }

  function renderConteudo() {
    if (!jogo || !casa || !fora) {
      return (
        <EmptyState
          icon={icons.naoEncontrado}
          title="Jogo não encontrado"
          message="Não foi possível abrir a avaliação deste jogo."
          action={{ label: 'Fechar', onPress: () => router.back() }}
        />
      );
    }

    if (estadoDoJogo(jogo, agora) !== 'terminado') {
      return (
        <EmptyState
          icon={icons.horario}
          title="Ainda não podes avaliar"
          message="A avaliação abre no fim do jogo."
          action={{ label: 'Fechar', onPress: () => router.back() }}
        />
      );
    }

    return (
      <>
        <View>
          <ThemedText type="smallBold" style={styles.titulo} accessibilityRole="header">
            {existente ? 'Editar avaliação' : 'Avaliar experiência'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`${casa.nomeCurto} x ${fora.nomeCurto}${venue ? ` · ${venue.nome}` : ''}`}
          </ThemedText>
        </View>

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

        <CampoTexto
          label="Comentário"
          placeholder="O que correu bem ou mal? (opcional)"
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
            Dá uma nota de 1 a 5 às três categorias para guardar.
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
  titulo: {
    fontSize: 22,
    lineHeight: 28,
  },
  centro: {
    textAlign: 'center',
  },
});
