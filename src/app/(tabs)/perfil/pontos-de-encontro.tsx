import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import {
  useDecideDraft,
  usePendingDrafts,
} from '@/features/meeting-points/hooks/useMeetingPointDrafts';
import {
  DraftRefused,
  type MeetingPointDraft,
  type MeetingPointOrigin,
} from '@/features/meeting-points/types';
import { useMyProfile } from '@/features/profile/hooks/useMyProfile';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { Button } from '@/ui/button';
import { CampoTexto } from '@/ui/campo-texto';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { ThemedText } from '@/ui/themed-text';

const ORIGENS: { id: MeetingPointOrigin; label: string }[] = [
  { id: 'clube', label: 'Clube' },
  { id: 'camara', label: 'Câmara' },
  { id: 'policia', label: 'Polícia' },
];

/** One draft: the article excerpt, and the fields to publish. */
function Rascunho({ rascunho }: { rascunho: MeetingPointDraft }) {
  const theme = useTheme();
  const decidir = useDecideDraft();
  const jogo = obterJogo(rascunho.fixtureId);
  const casa = jogo ? obterClube(jogo.casaId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  const clube = obterClube(rascunho.clubId);

  const [verTudo, setVerTudo] = useState(false);
  const [nome, setNome] = useState('');
  const [morada, setMorada] = useState('');
  const [horario, setHorario] = useState('');
  const [transporte, setTransporte] = useState('');
  const [nota, setNota] = useState('');
  const [origem, setOrigem] = useState<MeetingPointOrigin>('clube');
  const [publicadoPor, setPublicadoPor] = useState(clube?.nome ?? '');
  const [publicadoEm, setPublicadoEm] = useState(rascunho.foundAt.slice(0, 10));

  const completo =
    nome.trim().length >= 2 &&
    morada.trim().length >= 2 &&
    horario.trim().length >= 2 &&
    transporte.trim().length >= 2 &&
    publicadoPor.trim().length >= 2 &&
    /^\d{4}-\d{2}-\d{2}$/.test(publicadoEm);

  function avisarErro(erro: unknown) {
    if (erro instanceof DraftRefused && erro.reason === 'invalid-fields') {
      Alert.alert('Falta informação', 'Revê os campos: há algum vazio ou demasiado longo.');
    } else if (erro instanceof DraftRefused && erro.reason === 'already-decided') {
      Alert.alert('Já tratado', 'Outro administrador já decidiu este rascunho.');
    } else {
      Alert.alert('Não deu para guardar', 'Verifica a ligação e tenta outra vez.');
    }
  }

  function publicar() {
    decidir.mutate(
      {
        draftId: rascunho.id,
        action: 'approve',
        fields: {
          name: nome.trim(),
          address: morada.trim(),
          schedule: horario.trim(),
          transport: transporte.trim(),
          note: nota.trim() || null,
          origin: origem,
          publishedBy: publicadoPor.trim(),
          publishedOn: publicadoEm,
        },
      },
      {
        onSuccess: ({ located }) =>
          Alert.alert(
            'Publicado',
            located
              ? 'O ponto de encontro já aparece no jogo, com mapa e caminho.'
              : 'Publicado, mas não encontrámos o sítio no mapa: aparece sem mapa. Podes corrigir a morada e publicar outra vez.'
          ),
        onError: avisarErro,
      }
    );
  }

  function descartar() {
    Alert.alert('Descartar este rascunho?', 'Não aparece nada na app.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: () =>
          decidir.mutate({ draftId: rascunho.id, action: 'dismiss' }, { onError: avisarErro }),
      },
    ]);
  }

  return (
    <Card style={styles.card}>
      <ThemedText type="eyebrow" themeColor="accentInk">
        {casa && fora ? `${casa.nomeCurto} x ${fora.nomeCurto}` : rascunho.fixtureId}
      </ThemedText>
      {jogo ? (
        <ThemedText type="small" themeColor="textSecondary">
          {formatarDiaEHora(new Date(jogo.inicio))}
        </ThemedText>
      ) : null}

      <Pressable
        hitSlop={8}
        onPress={() => void Linking.openURL(rascunho.sourceUrl).catch(() => undefined)}
        accessibilityRole="link"
        accessibilityLabel={`Abrir a notícia: ${rascunho.sourceTitle}`}>
        <ThemedText style={[styles.titulo, { color: theme.accentInk }]}>
          {rascunho.sourceTitle}
        </ThemedText>
      </Pressable>

      <ThemedText type="small" themeColor="textSecondary" numberOfLines={verTudo ? undefined : 8}>
        {rascunho.excerpt}
      </ThemedText>
      <LinkTexto
        label={verTudo ? 'Mostrar menos' : 'Ver o excerto todo'}
        onPress={() => setVerTudo((atual) => !atual)}
      />

      <CampoTexto
        label="Ponto de encontro"
        value={nome}
        onChangeText={setNome}
        maxLength={120}
        placeholder="Piazza del Duomo"
      />
      <CampoTexto
        label="Morada ou zona"
        value={morada}
        onChangeText={setMorada}
        maxLength={200}
        placeholder="Piazza del Duomo, centro de Milão"
      />
      <CampoTexto
        label="Horário"
        value={horario}
        onChangeText={setHorario}
        maxLength={300}
        placeholder="Concentração a partir das 16h00 locais (15h00 em Portugal)."
      />
      <CampoTexto
        label="Transporte até ao estádio"
        value={transporte}
        onChangeText={setTransporte}
        maxLength={500}
        placeholder="Metro dedicado na estação Duomo até Lotto."
      />
      <CampoTexto
        label="Notas (opcional)"
        value={nota}
        onChangeText={setNota}
        maxLength={800}
        placeholder="Documento de identificação obrigatório."
      />
      <CampoTexto
        label="Publicado por"
        value={publicadoPor}
        onChangeText={setPublicadoPor}
        maxLength={80}
      />
      <CampoTexto
        label="Data de publicação (AAAA-MM-DD)"
        value={publicadoEm}
        onChangeText={setPublicadoEm}
        maxLength={10}
      />

      <View style={styles.origens}>
        {ORIGENS.map((opcao) => (
          <Chip
            key={opcao.id}
            label={opcao.label}
            selected={origem === opcao.id}
            onPress={() => setOrigem(opcao.id)}
          />
        ))}
      </View>

      <Button
        label={decidir.isPending ? 'A guardar…' : 'Publicar ponto de encontro'}
        icon={icons.selecionado}
        disabled={!completo || decidir.isPending}
        onPress={publicar}
      />
      <Button
        label="Descartar"
        variant="secondary"
        disabled={decidir.isPending}
        onPress={descartar}
      />
    </Card>
  );
}

/** Admins confirm the meeting points found on the clubs' news pages before fans see them. */
export default function PontosDeEncontroScreen() {
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  const admin = perfil.data?.isAdmin === true;
  const rascunhos = usePendingDrafts(admin);

  if (!admin) {
    return (
      <Screen>
        <EmptyState
          icon={icons.pontoEncontro}
          title="Só para administradores"
          message="Aqui confirmam-se os pontos de encontro encontrados nas notícias dos clubes."
        />
      </Screen>
    );
  }

  const lista = rascunhos.data ?? [];

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">
        Três vezes por dia procuramos informações para os adeptos nas notícias do Benfica, do FC
        Porto e do Sporting. Lê o excerto (ou abre a notícia), preenche os campos e publica. Nada
        aparece aos adeptos sem esta confirmação.
      </ThemedText>
      {rascunhos.isLoading ? null : lista.length === 0 ? (
        <EmptyState
          icon={icons.pontoEncontro}
          title="Nada por confirmar"
          message="Quando um clube publicar informações para os adeptos de um jogo fora, aparecem aqui."
        />
      ) : (
        lista.map((rascunho) => <Rascunho key={rascunho.id} rascunho={rascunho} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  titulo: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 800,
    textDecorationLine: 'underline',
  },
  origens: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
