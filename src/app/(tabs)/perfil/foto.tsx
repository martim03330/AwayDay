import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { FotoRecordacao } from '@/components/foto-recordacao';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { obterMissao } from '@/mocks/missoes';
import type { FotoMissao } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';
import { ThemedText } from '@/ui/themed-text';

function explicacao(foto: FotoMissao) {
  if (foto.exemplo) return 'Foto de exemplo: este aparelho não tem câmara. Não conta como verificada.';
  if (foto.verificada) return 'Tirada em dia de jogo, com check-in feito perto do estádio.';
  return 'Tirada fora de dia de jogo ou sem check-in perto do estádio. A missão conta na mesma.';
}

export default function FotoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { fotoId } = useLocalSearchParams<{ fotoId: string }>();
  const { fotosMissoes, apagarFoto } = useAppState();

  const foto = fotosMissoes.find((candidata) => candidata.id === fotoId);
  const missao = foto ? obterMissao(foto.missaoId) : undefined;

  if (!foto || !missao) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.conteudo}>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Esta recordação já não está cá"
          message="Foi apagada do álbum."
          action={{ label: 'Fechar', onPress: () => router.back() }}
        />
      </ScrollView>
    );
  }

  const estadio = foto.estadioId ? obterEstadio(foto.estadioId) : undefined;
  const jogo = foto.jogoId ? obterJogo(foto.jogoId) : undefined;
  const nomeDoJogo = jogo
    ? `${obterClube(jogo.casaId)?.nomeCurto ?? jogo.casaId} x ${obterClube(jogo.foraId)?.nomeCurto ?? jogo.foraId}`
    : null;

  function confirmarApagar() {
    Alert.alert(
      'Apagar esta recordação?',
      `A missão "${missao?.titulo}" volta a ficar à espera de foto.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () => {
            if (foto) apagarFoto(foto.id);
            router.back();
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.conteudo}>
      <FotoRecordacao foto={foto} style={styles.foto} />

      <View style={styles.cabecalho}>
        <View style={[styles.distintivo, { backgroundColor: theme.successBackground }]}>
          <Icon name={missao.distintivo.icon} size={26} color={theme.accentInk} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="section" style={styles.titulo} accessibilityRole="header">
            {missao.distintivo.nome}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {missao.titulo}
          </ThemedText>
        </View>
      </View>

      <View style={styles.etiquetas}>
        <Etiqueta
          icon={foto.verificada ? icons.visitado : icons.porVerificar}
          label={foto.verificada ? 'Verificada' : 'Por verificar'}
          tone={foto.verificada ? 'positivo' : 'aviso'}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {explicacao(foto)}
      </ThemedText>

      <Card style={styles.detalhes}>
        <ListRow
          leading={<IconCircle name={icons.horario} />}
          title="Tirada"
          subtitle={formatarDiaEHora(new Date(foto.tiradaEm))}
        />
        {estadio ? (
          <ListRow
            leading={<IconCircle name={icons.estadio} />}
            title="Estádio"
            subtitle={`${estadio.nome}, ${estadio.cidade}`}
          />
        ) : null}
        {nomeDoJogo ? (
          <ListRow leading={<IconCircle name={icons.jogos} />} title="Jogo" subtitle={nomeDoJogo} />
        ) : null}
      </Card>

      <Button
        label="Apagar do álbum"
        variant="secondary"
        icon={icons.apagar}
        onPress={confirmarApagar}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  foto: {
    aspectRatio: 1,
    marginTop: Spacing.two,
    borderRadius: Radius.card,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  distintivo: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    lineHeight: 30,
  },
  flex: {
    flex: 1,
  },
  etiquetas: {
    flexDirection: 'row',
  },
  detalhes: {
    gap: 14,
  },
});
