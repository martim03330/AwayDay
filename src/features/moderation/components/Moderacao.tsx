import { useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { blockUser, ModerationRefused, reportContent, unblockUser } from '@/features/moderation/api';
import {
  useBlockedPeople,
  useRefreshAfterModeration,
} from '@/features/moderation/hooks/useModeration';
import {
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  type ReportKind,
  type ReportReason,
} from '@/features/moderation/types';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/session';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Chip } from '@/ui/chip';
import { LinkTexto } from '@/ui/link-texto';
import { MensagemErro } from '@/ui/mensagem-erro';
import { ThemedText } from '@/ui/themed-text';

// Report and block, from wherever a person or their messages show up: a long-press on a message, or the discreet «⋯»
// next to a person. One hook gives the menu and the report sheet; the screen renders `elemento` once.

export type Pessoa = { profileId: string; nome: string };

export type Opcao = { label: string; destrutiva?: boolean; onPress: () => void };

type AlvoDenuncia = {
  kind: ReportKind;
  targetId: string;
  titulo: string;
  /** The person behind it, to offer blocking afterwards. Empty for a group. */
  pessoa: Pessoa | null;
};

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || nome;
}

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof ModerationRefused)) return 'Não deu para enviar. Tenta outra vez.';
  switch (erro.reason) {
    case 'not_found':
      return 'Isto já não está cá. Pode ter sido apagado entretanto.';
    case 'own_content':
      return 'Isso é teu: em vez de denunciar, podes apagar.';
    case 'no_photo':
      return 'Essa pessoa já não tem foto.';
    case 'rate_limited':
      return 'Já enviaste muitas denúncias hoje. Volta a tentar amanhã.';
    default:
      return 'Não deu para enviar. Tenta outra vez.';
  }
}

export function useModeracao() {
  const userId = useUserId();
  const bloqueados = useBlockedPeople(userId !== null);
  const refrescar = useRefreshAfterModeration();
  const [denuncia, setDenuncia] = useState<AlvoDenuncia | null>(null);
  const [menu, setMenu] = useState<{ titulo: string; opcoes: Opcao[] } | null>(null);

  const estaBloqueado = (profileId: string) =>
    (bloqueados.data ?? []).some((pessoa) => pessoa.profileId === profileId);

  function mostrarMenu(titulo: string, opcoes: Opcao[]) {
    if (Platform.OS === 'ios') {
      const destrutivas = opcoes.flatMap((opcao, indice) => (opcao.destrutiva ? [indice] : []));
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: titulo,
          options: [...opcoes.map((opcao) => opcao.label), 'Cancelar'],
          cancelButtonIndex: opcoes.length,
          destructiveButtonIndex: destrutivas,
        },
        (indice) => opcoes[indice]?.onPress()
      );
      return;
    }
    setMenu({ titulo, opcoes });
  }

  function bloquear(pessoa: Pessoa) {
    const nome = primeiroNome(pessoa.nome);
    Alert.alert(
      `Bloquear ${pessoa.nome}?`,
      `Deixas de ver o que ${nome} escreve nos grupos e no carro, e não te pode pedir amizade nem convidar-te. Não lhe dizemos nada. Podes desfazer nas Definições.`,
      [
        { text: 'Deixa estar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: () =>
            void blockUser(pessoa.profileId)
              .then(() => refrescar())
              .then(() => Alert.alert('Feito', `Já não vês o que ${nome} escreve.`))
              .catch(() => Alert.alert('Não deu para bloquear', 'Tenta outra vez daqui a pouco.')),
        },
      ]
    );
  }

  function desbloquear(pessoa: Pessoa) {
    void unblockUser(pessoa.profileId)
      .then(() => refrescar())
      .catch(() => Alert.alert('Não deu para desbloquear', 'Tenta outra vez daqui a pouco.'));
  }

  function opcaoDeBloqueio(pessoa: Pessoa): Opcao {
    return estaBloqueado(pessoa.profileId)
      ? { label: `Desbloquear ${primeiroNome(pessoa.nome)}`, onPress: () => desbloquear(pessoa) }
      : {
          label: `Bloquear ${primeiroNome(pessoa.nome)}`,
          destrutiva: true,
          onPress: () => bloquear(pessoa),
        };
  }

  /** Long-press on someone else's message. `extras` go first (e.g. «Apagar» for the group owner). */
  function abrirMensagem(input: {
    kind: 'message' | 'ride_message';
    messageId: string;
    pessoa: Pessoa;
    extras?: Opcao[];
  }) {
    mostrarMenu(`Mensagem de ${input.pessoa.nome}`, [
      ...(input.extras ?? []),
      {
        label: 'Denunciar mensagem',
        onPress: () =>
          setDenuncia({
            kind: input.kind,
            targetId: input.messageId,
            titulo: 'Denunciar mensagem',
            pessoa: input.pessoa,
          }),
      },
      opcaoDeBloqueio(input.pessoa),
    ]);
  }

  /** The «⋯» next to a person. `extras` go first. */
  function abrirPessoa(input: { pessoa: Pessoa; temFoto?: boolean; extras?: Opcao[] }) {
    const { pessoa } = input;
    mostrarMenu(pessoa.nome, [
      ...(input.extras ?? []),
      {
        label: `Denunciar ${primeiroNome(pessoa.nome)}`,
        onPress: () =>
          setDenuncia({
            kind: 'profile',
            targetId: pessoa.profileId,
            titulo: `Denunciar ${pessoa.nome}`,
            pessoa,
          }),
      },
      ...(input.temFoto
        ? [
            {
              label: 'Denunciar a foto',
              onPress: () =>
                setDenuncia({
                  kind: 'profile_photo',
                  targetId: pessoa.profileId,
                  titulo: `Denunciar a foto de ${primeiroNome(pessoa.nome)}`,
                  pessoa,
                }),
            },
          ]
        : []),
      opcaoDeBloqueio(pessoa),
    ]);
  }

  /** A group whose name or photo crosses the line. */
  function denunciarGrupo(groupId: string, nome: string) {
    setDenuncia({ kind: 'group', targetId: groupId, titulo: `Denunciar «${nome}»`, pessoa: null });
  }

  const elemento = (
    <>
      <FolhaDeDenuncia
        alvo={denuncia}
        jaBloqueado={denuncia?.pessoa ? estaBloqueado(denuncia.pessoa.profileId) : true}
        onBloquear={(pessoa) => {
          setDenuncia(null);
          // iOS drops an alert asked for while the sheet is still sliding away.
          setTimeout(() => bloquear(pessoa), 450);
        }}
        onFechar={() => setDenuncia(null)}
      />
      <MenuDeAcoes
        menu={menu}
        onEscolher={(opcao) => {
          setMenu(null);
          opcao.onPress();
        }}
        onFechar={() => setMenu(null)}
      />
    </>
  );

  return { abrirMensagem, abrirPessoa, denunciarGrupo, elemento };
}

/** The reason, an optional note, and a thank-you. */
function FolhaDeDenuncia({
  alvo,
  jaBloqueado,
  onBloquear,
  onFechar,
}: {
  alvo: AlvoDenuncia | null;
  jaBloqueado: boolean;
  onBloquear: (pessoa: Pessoa) => void;
  onFechar: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [motivo, setMotivo] = useState<ReportReason | null>(null);
  const [nota, setNota] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setMotivo(null);
    setNota('');
    setEnviada(false);
    setErro(null);
    onFechar();
  }

  async function enviar() {
    if (!alvo || !motivo) return;
    setErro(null);
    setAEnviar(true);
    try {
      await reportContent({ kind: alvo.kind, targetId: alvo.targetId, reason: motivo, note: nota });
      setEnviada(true);
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    } finally {
      setAEnviar(false);
    }
  }

  const quem = alvo?.pessoa ? primeiroNome(alvo.pessoa.nome) : null;

  return (
    <Modal
      visible={alvo !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={fechar}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.conteudo, { paddingBottom: insets.bottom + Spacing.four }]}>
        {enviada ? (
          <>
            <ThemedText type="title" style={styles.titulo}>
              Obrigado por avisares
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Vamos ver isto com calma. Se passou das marcas, sai da app.
              {quem ? ` ${quem} não fica a saber que foste tu.` : ''}
            </ThemedText>
            {alvo?.pessoa && !jaBloqueado ? (
              <Button
                label={`Bloquear ${primeiroNome(alvo.pessoa.nome)} também`}
                variant="secondary"
                onPress={() => {
                  const pessoa = alvo.pessoa;
                  fechar();
                  if (pessoa) onBloquear(pessoa);
                }}
              />
            ) : null}
            <Button label="Fechar" onPress={fechar} />
          </>
        ) : (
          <>
            <ThemedText type="title" style={styles.titulo}>
              {alvo?.titulo ?? 'Denunciar'}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {quem
                ? `Diz-nos o que se passa. Quem gere a app vê a denúncia; ${quem} não sabe que foste tu.`
                : 'Diz-nos o que se passa. Quem gere a app vê a denúncia; ninguém sabe que foste tu.'}
            </ThemedText>
            <View style={styles.chips}>
              {REPORT_REASONS.map((razao) => (
                <Chip
                  key={razao}
                  label={REPORT_REASON_LABELS[razao]}
                  selected={razao === motivo}
                  onPress={() => setMotivo(razao)}
                />
              ))}
            </View>
            <Campo
              label="Queres acrescentar alguma coisa? (opcional)"
              value={nota}
              onChangeText={setNota}
              placeholder="Ex.: não é a primeira vez"
              maxLength={500}
            />
            {erro ? <MensagemErro>{erro}</MensagemErro> : null}
            <Button
              label={aEnviar ? 'A enviar…' : 'Enviar denúncia'}
              disabled={!motivo || aEnviar}
              onPress={() => void enviar()}
            />
            <LinkTexto neutro label="Deixa estar" onPress={fechar} />
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

/** Off iOS there is no native action sheet: a small sheet at the bottom does the same job. */
function MenuDeAcoes({
  menu,
  onEscolher,
  onFechar,
}: {
  menu: { titulo: string; opcoes: Opcao[] } | null;
  onEscolher: (opcao: Opcao) => void;
  onFechar: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={menu !== null} transparent animationType="fade" onRequestClose={onFechar}>
      <View style={styles.fundo}>
        {/* The dark background closes the menu; the menu sits beside it, not inside it, so a tap between options
            doesn't close it and a screen reader never finds buttons inside a button. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onFechar}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        />
        <View
          style={[
            styles.menu,
            { backgroundColor: theme.backgroundElement, marginBottom: insets.bottom + Spacing.two },
          ]}>
          {menu ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.tituloMenu}>
              {menu.titulo}
            </ThemedText>
          ) : null}
          {(menu?.opcoes ?? []).map((opcao) => (
            <Pressable
              key={opcao.label}
              onPress={() => onEscolher(opcao)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.opcao,
                { borderTopColor: theme.backgroundSelected },
                pressed && { backgroundColor: theme.backgroundSelected },
              ]}>
              <ThemedText style={opcao.destrutiva ? { color: theme.dangerText } : undefined}>
                {opcao.label}
              </ThemedText>
            </Pressable>
          ))}
          <Pressable
            onPress={onFechar}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.opcao,
              { borderTopColor: theme.backgroundSelected },
              pressed && { backgroundColor: theme.backgroundSelected },
            ]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Cancelar
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** The discreet «⋯» at the end of a person's row. */
export function BotaoMais({ nome, onPress }: { nome: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`Mais opções sobre ${nome}`}
      style={({ pressed }) => [styles.mais, pressed && { opacity: 0.5 }]}>
      <ThemedText style={[styles.reticencias, { color: theme.textMuted }]}>⋯</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Spacing.three,
    padding: 20,
  },
  titulo: {
    fontSize: 30,
    lineHeight: 34,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  fundo: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: Spacing.two,
  },
  menu: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  tituloMenu: {
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  opcao: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  mais: {
    paddingHorizontal: Spacing.one,
    minWidth: 28,
    alignItems: 'center',
  },
  reticencias: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: 800,
  },
});
