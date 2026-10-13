import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
 type FlatList } from 'react-native';
import Animated, { Easing, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { GroupRefused, markGroupMessagesRead, type GroupMessage } from '@/features/groups/api';
import type { FixturePlan } from '@/features/groups/plans';
import { CaraDoGrupo } from '@/features/groups/components/CaraDoGrupo';
import { CartaoDoPlano } from '@/features/groups/components/CartaoDoPlano';
import { FundoConversa, fundoEscuro } from '@/features/groups/components/FundoConversa';
import { PlanoFixado } from '@/features/groups/components/PlanoFixado';
import {
  plansKey,
  useGroupChannel,
  useGroupChatActions,
  useGroupFixturePlans,
  useGroupFromInbox,
  useGroupMembers,
  useGroupMessages,
  usePlanConflicts,
  usePlans,
  useRefreshGroups,
} from '@/features/groups/hooks/useGroups';
import { useModeracao } from '@/features/moderation/components/Moderacao';
import { useProfileCards } from '@/features/profile/hooks/useMyProfile';
import { useTheme } from '@/hooks/use-theme';
import { aindaDaParaEditar, chaveDaMensagem, eLocal, minhaReacao, proximaReacao, type Emoji } from '@/lib/conversa';
import { chaveDoDia, formatarDia, formatarHora } from '@/lib/datas';
import { mencoesNoTexto, type Mencionavel } from '@/lib/mencoes';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { AvisoDeConversa, BolhaDeConversa, CaixaDeEscrita, PastilhaDeConversa, type PosicaoNoEcra } from '@/ui/conversa';
import { EmptyState } from '@/ui/empty-state';
import { Icon, icons, type IconName } from '@/ui/icon';
import { MenuDaMensagem, type AcaoDaMensagem } from '@/ui/menu-da-mensagem';
import { SkeletonConversa } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

/** How the rest of the chat makes room for a new message: as fast as the send animation, easing out. */
const DESLIZAR_MENSAGENS = LinearTransition.duration(240).easing(Easing.out(Easing.cubic));

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof GroupRefused)) return 'Não deu para enviar. Tenta outra vez.';
  switch (erro.reason) {
    case 'not_member':
      return 'Já não estás neste grupo.';
    case 'bad_message':
      return 'Escreve alguma coisa (até 500 letras).';
    case 'rate_limited':
      return 'Escreveste muitas mensagens hoje. Continua amanhã.';
    default:
      return 'Não deu para enviar. Tenta outra vez.';
  }
}

/** "Só tu por aqui", "2 online". Quem está online é quem tem esta conversa aberta agora. */
function textoOnline(online: number) {
  return online <= 1 ? 'só tu por aqui' : `${online} online`;
}

/**
 * A conversa de um grupo. É aqui que a malta combina: escreve, diz em que tasco está e, a partir daqui, abre os
 * planos e o histórico das viagens.
 */
export default function ConversaDoGrupoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const alturaDoCabecalho = useHeaderHeight();
  const userId = useUserId();
  const { grupoId } = useLocalSearchParams<{ grupoId?: string }>();

  const {
    group: grupo,
    isLoading,
    isError: inboxFalhou,
    data: inboxGuardada,
    refetch: tentarOutraVez,
  } = useGroupFromInbox(grupoId ?? null, userId !== null);
  // The list never arrived (offline, timeout): that says nothing about being in the group.
  const semLigacao = inboxFalhou && inboxGuardada === undefined;
  const mensagens = useGroupMessages(grupo ? grupo.id : null);
  const online = useGroupChannel(grupo ? grupo.id : null, userId);
  const cartoes = useProfileCards([
    ...new Set((mensagens.data ?? []).map((mensagem) => mensagem.profileId)),
  ]);
  const idsDosPlanos = (mensagens.data ?? []).flatMap((mensagem) =>
    mensagem.planId ? [mensagem.planId] : []
  );
  const planos = usePlans(idsDosPlanos);
  const planosDoGrupo = useGroupFixturePlans(grupo ? grupo.id : null);
  const membros = useGroupMembers(grupo ? grupo.id : null);
  const conflitos = usePlanConflicts(idsDosPlanos);
  const queryClient = useQueryClient();
  const refrescar = useRefreshGroups();
  const listaRef = useRef<FlatList<NonNullable<typeof mensagens.data>[number]>>(null);
  const [destaque, setDestaque] = useState<string | null>(null);
  const moderacao = useModeracao();
  const acoes = useGroupChatActions(grupo ? grupo.id : null, userId ? { profileId: userId, nome: 'Tu' } : null);

  const [texto, setTexto] = useState('');
  const [aResponder, setAResponder] = useState<GroupMessage | null>(null);
  const [aEditar, setAEditar] = useState<GroupMessage | null>(null);
  const [menuDe, setMenuDe] = useState<{ mensagem: GroupMessage; podeEditar: boolean; posicao: PosicaoNoEcra | null; comNome: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aTentar, setATentar] = useState(false);

  async function tentarDeNovo() {
    setATentar(true);
    try {
      await tentarOutraVez();
    } finally {
      setATentar(false);
    }
  }

  // Abrir a conversa é lê-la: o número de mensagens por ler desaparece da lista da Malta.
  const ultimaDeOutro = (mensagens.data ?? []).find((mensagem) => !mensagem.mine)?.id ?? null;
  useEffect(() => {
    if (!grupoId || !ultimaDeOutro) return;
    void markGroupMessagesRead(grupoId)
      .then(() => refrescar())
      .catch(() => undefined);
  }, [grupoId, ultimaDeOutro, refrescar]);

  if (userId && grupoId && !grupo && semLigacao) {
    return (
      <ScrollView
        style={[styles.tudo, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.semLigacao}
        refreshControl={
          <RefreshControl refreshing={aTentar} onRefresh={() => void tentarDeNovo()} />
        }>
        <Stack.Screen options={{ title: 'Grupo' }} />
        <EmptyState
          icon={icons.erro}
          title="Sem ligação"
          message="Puxa para baixo para tentar outra vez."
          action={{ label: 'Tentar outra vez', onPress: () => void tentarDeNovo() }}
        />
      </ScrollView>
    );
  }

  if (!userId || !grupoId || (!grupo && !isLoading)) {
    return (
      <View style={[styles.tudo, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Grupo' }} />
        <EmptyState
          icon={icons.naoEncontrado}
          title={userId ? 'Já não estás neste grupo' : 'Precisas de conta'}
          message={
            userId
              ? 'Podes ter saído, ou alguém pode ter-te tirado.'
              : 'Os grupos juntam pessoas reais: entra para falares com a tua malta.'
          }
          action={{ label: 'Voltar à Malta', onPress: () => router.replace('/malta') }}
        />
      </View>
    );
  }

  if (!grupo) {
    return (
      <View style={[styles.tudo, styles.emBaixo, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Grupo' }} />
        <SkeletonConversa />
      </View>
    );
  }

  const lista = mensagens.data ?? [];
  // Tapping the quote of a reply: the chat goes to the original message and it flashes (as in WhatsApp).
  const irParaMensagem = (id: string) => {
    const indice = lista.findIndex((mensagem) => mensagem.id === id);
    if (indice < 0) return;
    listaRef.current?.scrollToIndex({ index: indice, animated: true, viewPosition: 0.5 });
    setDestaque(id);
    setTimeout(() => setDestaque((atual) => (atual === id ? null : atual)), 1500);
  };
  const escuro = fundoEscuro(grupo.fundo);
  const fotoDe = (profileId: string) =>
    (cartoes.data ?? []).find((cartao) => cartao.profileId === profileId)?.avatarUrl;
  // Who can be mentioned (everyone but you), and every name in the group so mentions show in bold.
  const mencionaveis: Mencionavel[] = (membros.data ?? [])
    .filter((membro) => !membro.isMine)
    .map((membro) => ({ profileId: membro.profileId, nome: membro.displayName, fotoUrl: fotoDe(membro.profileId) }));
  const nomesDoGrupo = (membros.data ?? []).map((membro) => membro.displayName);

  // Shows at once (see useGroupChatActions). If the server refuses, the text and the reply come back to the box.
  async function enviar() {
    if (!grupo || texto.trim().length === 0) return;
    const escrito = texto;
    const resposta = aResponder;
    const edicao = aEditar;
    setErro(null);
    setTexto('');
    setAResponder(null);
    setAEditar(null);
    try {
      if (edicao) await acoes.editar(edicao, escrito);
      else await acoes.enviar(escrito, resposta, mencoesNoTexto(escrito, mencionaveis));
    } catch (problema) {
      setTexto(escrito);
      setAResponder(resposta);
      setAEditar(edicao);
      setErro(mensagemDeRecusa(problema));
    }
  }

  const apagar = (mensagem: GroupMessage) =>
    Alert.alert('Apagar a mensagem?', 'Desaparece para toda a gente do grupo.', [
      { text: 'Deixa estar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () =>
          void acoes.apagar(mensagem).catch(() => setErro('Não deu para apagar. Tenta outra vez.')),
      },
    ]);

  function reagir(mensagem: GroupMessage, emoji: Emoji) {
    void acoes
      .reagir(mensagem, proximaReacao(mensagem.reactions, emoji))
      .catch(() => setErro('Não deu para reagir. Tenta outra vez.'));
  }

  function responder(mensagem: GroupMessage) {
    setAEditar(null);
    setAResponder(mensagem);
  }

  function editar(mensagem: GroupMessage) {
    setAResponder(null);
    setAEditar(mensagem);
    setTexto(mensagem.body);
  }

  function cancelarContexto() {
    if (aEditar) setTexto('');
    setAEditar(null);
    setAResponder(null);
  }

  const abrirPessoa = (profileId: string) =>
    router.push({ pathname: '/pessoa/[pessoaId]', params: { pessoaId: profileId } });

  // Long-press on a text message: react, reply, edit (yours, for 15 minutes), delete, or report someone else's.
  function acoesDoMenu(mensagem: GroupMessage, podeEditar: boolean): AcaoDaMensagem[] {
    const acoes: AcaoDaMensagem[] = [
      { label: 'Responder', icon: icons.responder, onPress: () => responder(mensagem) },
    ];
    if (podeEditar) acoes.push({ label: 'Editar', icon: icons.editar, onPress: () => editar(mensagem) });
    if (!mensagem.mine) {
      acoes.push({ label: 'Ver perfil', icon: icons.perfil, onPress: () => abrirPessoa(mensagem.profileId) });
    }
    if (mensagem.canRemove) {
      acoes.push({ label: 'Apagar', icon: icons.apagar, perigo: true, onPress: () => apagar(mensagem) });
    }
    if (!mensagem.mine) {
      acoes.push({
        label: 'Denunciar ou bloquear',
        icon: icons.aviso,
        perigo: true,
        onPress: () =>
          moderacao.abrirMensagem({
            kind: 'message',
            messageId: mensagem.id,
            pessoa: { profileId: mensagem.profileId, nome: mensagem.displayName },
          }),
      });
    }
    return acoes;
  }

  // Long-press on anything else: a plan card or a notice is the group's, not a person's: only delete. A «Estou aqui»
  // can be deleted by its author, or reported.
  const aoCarregarSemLargar = (mensagem: GroupMessage) => {
    if (mensagem.mine || mensagem.kind === 'plano' || mensagem.kind === 'aviso') {
      return mensagem.canRemove ? () => apagar(mensagem) : undefined;
    }
    return () =>
      moderacao.abrirMensagem({
        kind: 'message',
        messageId: mensagem.id,
        pessoa: { profileId: mensagem.profileId, nome: mensagem.displayName },
        extras: mensagem.canRemove
          ? [{ label: 'Apagar', destrutiva: true, onPress: () => apagar(mensagem) }]
          : [],
      });
  };

  const abrirDefinicoes = () =>
    router.push({ pathname: '/grupos/[grupoId]/definicoes', params: { grupoId: grupo.id } });

  return (
    <View style={styles.tudo}>
      <Stack.Screen
        options={{
          // O título a sério é o de baixo (foto, nome e online); este é o que aparece no «voltar» dos ecrãs seguintes.
          title: grupo.name,
          headerTitle: () => (
            <Pressable
              onPress={abrirDefinicoes}
              style={styles.titulo}
              accessibilityRole="button"
              accessibilityLabel={`${grupo.name}, ${textoOnline(online.length)}. Toca para ver o grupo.`}>
              <CaraDoGrupo nome={grupo.name} url={grupo.photoUrl} size={34} />
              <View style={styles.tituloTexto}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {grupo.name}
                </ThemedText>
                <View style={styles.linhaOnline}>
                  {online.length > 1 ? (
                    <View style={[styles.pontoOnline, { backgroundColor: theme.success }]} />
                  ) : null}
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {`${plural(grupo.members, 'pessoa', 'pessoas')} · ${textoOnline(online.length)}`}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          ),
        }}
      />

      <FundoConversa fundo={grupo.fundo} />
      {moderacao.elemento}
      <MenuDaMensagem
        texto={menuDe?.mensagem.body ?? null}
        minha={menuDe?.mensagem.mine ?? false}
        posicao={menuDe?.posicao ?? null}
        hora={
          menuDe
            ? `${menuDe.mensagem.editedAt !== null ? 'editada · ' : ''}${formatarHora(new Date(menuDe.mensagem.createdAt))}`
            : undefined
        }
        nome={menuDe?.comNome ? menuDe.mensagem.displayName : null}
        citacao={menuDe?.mensagem.replyTo ?? null}
        minhaReacao={menuDe ? minhaReacao(menuDe.mensagem.reactions) : null}
        onReagir={menuDe ? (emoji) => reagir(menuDe.mensagem, emoji) : undefined}
        acoes={menuDe ? acoesDoMenu(menuDe.mensagem, menuDe.podeEditar) : []}
        onFechar={() => setMenuDe(null)}
      />

      <KeyboardAvoidingView
        style={styles.tudo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={alturaDoCabecalho}>
        <PlanoFixado
          planos={planosDoGrupo.data ?? []}
          onAbrir={(plano) =>
            router.push({
              pathname: '/grupos/[grupoId]/plano/[planoId]',
              params: { grupoId: grupo.id, planoId: plano.id },
            })
          }
        />
        {lista.length === 0 ? (
          // Uma lista invertida desenharia isto de pernas para o ar: sem mensagens, fica um ecrã normal.
          <View style={[styles.tudo, styles.centro]}>
            {mensagens.isLoading ? null : (
              <View style={[styles.vazio, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold" style={styles.textoVazio}>
                  A conversa ainda está a zeros
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.textoVazio}>
                  Manda a primeira mensagem à malta.
                </ThemedText>
              </View>
            )}
          </View>
        ) : (
          <Animated.FlatList
            ref={listaRef}
            // A message far up (not measured yet): go near it first, then to it.
            onScrollToIndexFailed={(falhou) => {
              listaRef.current?.scrollToOffset({ offset: falhou.averageItemLength * falhou.index, animated: true });
              setTimeout(
                () => listaRef.current?.scrollToIndex({ index: falhou.index, animated: true, viewPosition: 0.5 }),
                250
              );
            }}
            // The other messages slide up with the new one instead of jumping in one frame.
            itemLayoutAnimation={DESLIZAR_MENSAGENS}
            data={lista}
            inverted
            keyExtractor={chaveDaMensagem}
            contentContainerStyle={styles.mensagens}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            renderItem={({ item, index }) => {
              const anterior = lista[index + 1];
              const novoDia =
                !anterior ||
                chaveDoDia(new Date(anterior.createdAt)) !== chaveDoDia(new Date(item.createdAt));
              const mesmaPessoa = !novoDia && anterior?.profileId === item.profileId;
              return (
                <View>
                  {novoDia ? (
                    <PastilhaDeConversa
                      escuro={escuro}
                      texto={formatarDia(new Date(item.createdAt))}
                    />
                  ) : null}
                  {item.kind === 'plano' ? (
                    <MensagemPlano
                      mensagem={item}
                      plano={(planos.data ?? []).find((plano) => plano.id === item.planId) ?? null}
                      planosCarregados={planos.isSuccess}
                      vaisComOutroGrupo={item.planId ? conflitos.data?.[item.planId] : undefined}
                      escuro={escuro}
                      grupoAtualId={grupo.id}
                      onAbrir={() => {
                        if (!item.planId) return;
                        router.push({
                          pathname: '/grupos/[grupoId]/plano/[planoId]',
                          params: { grupoId: grupo.id, planoId: item.planId },
                        });
                      }}
                      onRespondido={() =>
                        void queryClient.invalidateQueries({ queryKey: plansKey() })
                      }
                      onLongPress={aoCarregarSemLargar(item)}
                    />
                  ) : item.kind === 'aviso' ? (
                    <AvisoDeConversa
                      escuro={escuro}
                      texto={item.body}
                      onLongPress={aoCarregarSemLargar(item)}
                    />
                  ) : item.kind === 'local' ? (
                    <MensagemLocal
                      mensagem={item}
                      escuro={escuro}
                      onPress={
                        item.placeId
                          ? () =>
                              router.push({
                                pathname: '/locais/[localId]',
                                params: { localId: item.placeId ?? '' },
                              })
                          : undefined
                      }
                      onLongPress={aoCarregarSemLargar(item)}
                    />
                  ) : (
                    <BolhaDeConversa
                      nome={item.displayName}
                      texto={item.body}
                      criadaEm={item.createdAt}
                      minha={item.mine}
                      mostrarQuem={!mesmaPessoa}
                      fotoUrl={fotoDe(item.profileId)}
                      citacao={item.replyTo}
                      onAbrirCitacao={item.replyTo ? () => item.replyTo && irParaMensagem(item.replyTo.id) : undefined}
                      destacada={destaque === item.id}
                      editada={item.editedAt !== null}
                      reacoes={item.reactions}
                      pendente={eLocal(item.id)}
                      animarEntrada={item.chaveLocal !== undefined}
                      nomesMencionaveis={nomesDoGrupo}
                      mencionaMe={item.mentionsMe}
                      onReagir={eLocal(item.id) ? undefined : (emoji) => reagir(item, emoji)}
                      onResponder={eLocal(item.id) ? undefined : () => responder(item)}
                      onAbrirPessoa={() => abrirPessoa(item.profileId)}
                      onLongPress={
                        eLocal(item.id)
                          ? undefined
                          : (posicao) =>
                              setMenuDe({
                                mensagem: item,
                                podeEditar: item.mine && aindaDaParaEditar(item.createdAt, Date.now()),
                                posicao,
                              comNome: !item.mine && (!mesmaPessoa),
                              })
                      }
                    />
                  )}
                </View>
              );
            }}
          />
        )}

        <View
          style={[
            styles.rodape,
            {
              backgroundColor: theme.backgroundElement,
              borderTopColor: theme.border,
              paddingBottom: Math.max(insets.bottom, Spacing.two),
            },
          ]}>
          <View style={styles.atalhos}>
            <Atalho
              icon={icons.calendario}
              label="Planos"
              onPress={() =>
                router.push({ pathname: '/grupos/[grupoId]/planos', params: { grupoId: grupo.id } })
              }
            />
            <Atalho
              icon={icons.album}
              label="Histórico"
              onPress={() =>
                router.push({
                  pathname: '/grupos/[grupoId]/historico',
                  params: { grupoId: grupo.id },
                })
              }
            />
          </View>

          {erro ? (
            <ThemedText type="small" style={{ color: theme.dangerText }}>
              {erro}
            </ThemedText>
          ) : null}

          <CaixaDeEscrita
            valor={texto}
            onChange={setTexto}
            onEnviar={() => void enviar()}
            aEnviar={false}
            placeholder="Escreve à malta…"
            accessibilityLabel="Escrever ao grupo"
            mencionaveis={mencionaveis}
            contexto={
              aEditar
                ? { titulo: 'A editar a mensagem', texto: aEditar.body, onCancelar: cancelarContexto }
                : aResponder
                  ? {
                      titulo: `A responder a ${aResponder.mine ? 'ti' : aResponder.displayName}`,
                      texto: aResponder.body,
                      onCancelar: cancelarContexto,
                    }
                  : null
            }
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** O convite para um jogo, a toda a largura da conversa. */
function MensagemPlano({
  mensagem,
  plano,
  planosCarregados,
  vaisComOutroGrupo,
  escuro,
  grupoAtualId,
  onAbrir,
  onRespondido,
  onLongPress,
}: {
  mensagem: GroupMessage;
  plano: FixturePlan | null;
  /** The plans have loaded: a plan that is not there was given up on (deleted), and its invite goes too. */
  planosCarregados: boolean;
  grupoAtualId: string;
  vaisComOutroGrupo?: string;
  escuro: boolean;
  onAbrir: () => void;
  onRespondido: () => void;
  onLongPress?: () => void;
}) {
  const theme = useTheme();
  // The plan was given up on: its invite is deleted with it, but the chat may still hold it until it refreshes.
  if (!plano && planosCarregados) return null;
  if (!plano) {
    // Ainda está a carregar: fica só a linha.
    return (
      <PastilhaDeConversa
        escuro={escuro}
        texto={`${mensagem.mine ? 'Convidaste' : `${mensagem.displayName} convidou`} para ${mensagem.body}`}
      />
    );
  }
  return (
    <Pressable onLongPress={onLongPress} style={styles.plano}>
      <CartaoDoPlano
        plano={plano}
        quemConvidou={mensagem.mine ? 'eu' : mensagem.displayName.split(' ')[0]}
        grupoAtualId={grupoAtualId}
        vaisComOutroGrupo={vaisComOutroGrupo}
        escuro={escuro}
        onAbrir={onAbrir}
        onRespondido={onRespondido}
      />
      <ThemedText
        type="small"
        style={[styles.horaPlano, { color: escuro ? '#FFFFFF' : theme.textMuted }]}>
        {formatarHora(new Date(mensagem.createdAt))}
      </ThemedText>
    </Pressable>
  );
}

/** «Estou aqui»: uma mensagem a meio da conversa, que abre o tasco. */
function MensagemLocal({
  mensagem,
  escuro,
  onPress,
  onLongPress,
}: {
  mensagem: GroupMessage;
  escuro: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const theme = useTheme();
  const quem = mensagem.mine ? 'Disseste que estás' : `${mensagem.displayName} está`;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${quem} ${mensagem.body}. ${onPress ? 'Toca para ver o tasco.' : ''}`}
      style={[
        styles.local,
        {
          backgroundColor: escuro ? 'rgba(255,255,255,0.92)' : theme.backgroundElement,
          borderColor: theme.highlight,
        },
      ]}>
      <Icon name={icons.tasco} size={18} color={escuro ? '#16713F' : theme.accentInk} />
      <ThemedText type="small" style={[styles.flex, escuro && { color: '#13241B' }]}>
        {`${quem} `}
        <ThemedText type="smallBold" style={escuro ? { color: '#13241B' } : undefined}>
          {mensagem.body}
        </ThemedText>
        {` · ${formatarHora(new Date(mensagem.createdAt))}`}
      </ThemedText>
    </Pressable>
  );
}

function Atalho({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => [
        styles.atalho,
        { backgroundColor: pressed ? theme.backgroundSelected : theme.background },
      ]}>
      <Icon name={icon} size={15} color={theme.accentInk} />
      <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  semLigacao: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  tudo: {
    flex: 1,
  },
  centro: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emBaixo: {
    justifyContent: 'flex-end',
  },
  flex: {
    flex: 1,
  },
  titulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: 260,
  },
  tituloTexto: {
    flexShrink: 1,
  },
  linhaOnline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  pontoOnline: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  mensagens: {
    padding: Spacing.three,
    gap: Spacing.one,
    flexGrow: 1,
  },
  textoVazio: {
    textAlign: 'center',
  },
  vazio: {
    alignSelf: 'center',
    maxWidth: 300,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    gap: Spacing.one,
  },
  plano: {
    marginVertical: Spacing.two,
    gap: 2,
  },
  horaPlano: {
    alignSelf: 'center',
    fontSize: 11,
  },
  local: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: 320,
    paddingHorizontal: Spacing.twoAndHalf,
    paddingVertical: Spacing.two,
    borderRadius: Radius.field,
    borderWidth: 1.5,
    marginVertical: Spacing.one,
  },
  rodape: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  atalhos: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  atalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.twoAndHalf,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
});
