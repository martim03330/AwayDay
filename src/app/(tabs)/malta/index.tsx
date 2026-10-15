import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { acceptGroupInvite, declineGroupInvite, FriendRefused } from '@/features/friends/api';
import { useMyGroupInvites, useRefreshFriends } from '@/features/friends/hooks/useFriends';
import type { GroupInboxItem } from '@/features/groups/api';
import { CaraDoGrupo } from '@/features/groups/components/CaraDoGrupo';
import { EntrarComCodigo } from '@/features/groups/components/EntrarComCodigo';
import { useMyGroupInbox, usePrecarregarGrupos, useRefreshGroups } from '@/features/groups/hooks/useGroups';
import { useTheme } from '@/hooks/use-theme';
import { usePuxarParaAtualizar } from '@/hooks/use-puxar-para-atualizar';
import { chaveDoDia, formatarData, formatarHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { Button } from '@/ui/button';
import { CabecalhoRelvado } from '@/ui/cabecalho-relvado';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';
import { MensagemErro } from '@/ui/mensagem-erro';
import { useVoltarAoTopo } from '@/ui/voltar-ao-topo';

const MARGEM = 20;

/** "20:31" se foi hoje, senão a data. */
function quando(iso: string) {
  const data = new Date(iso);
  return chaveDoDia(data) === chaveDoDia(new Date()) ? formatarHora(data) : formatarData(data);
}

/**
 * The last message or action under the group's name, kept short: «Rui: bora?», «Rui convidou para um jogo», «Rui
 * está num tasco». Nothing when nobody has written yet.
 */
function resumo(grupo: GroupInboxItem) {
  if (!grupo.last) return null;
  const quem = grupo.last.mine ? 'Tu' : grupo.last.name.split(' ')[0];
  if (grupo.last.kind === 'aviso') return grupo.last.body;
  if (grupo.last.kind === 'plano') {
    return grupo.last.mine ? 'Convidaste para um jogo' : `${quem} convidou para um jogo`;
  }
  return grupo.last.kind === 'local'
    ? grupo.last.mine
      ? 'Estás num tasco'
      : `${quem} está num tasco`
    : `${quem}: ${grupo.last.body}`;
}

/**
 * A Malta: os grupos com quem se vai aos jogos. Cada grupo é uma conversa — é lá que se combinam os planos, as
 * boleias e as contas.
 */
export default function MaltaScreen() {
  const { ref: paginaRef, onScroll, scrollEventThrottle, botao: voltarAoTopo } = useVoltarAoTopo({
    reporNoTopo: true,
  });
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const userId = useUserId();

  const inbox = useMyGroupInbox(userId !== null);
  const convites = useMyGroupInvites(userId !== null);
  const refrescarGrupos = useRefreshGroups();
  const refrescarAmigos = useRefreshFriends();
  const puxar = usePuxarParaAtualizar(() => Promise.all([refrescarGrupos(), refrescarAmigos()]));
  const [erro, setErro] = useState<string | null>(null);

  const grupos = inbox.data ?? [];
  usePrecarregarGrupos(grupos.map((grupo) => grupo.id));
  // A failed fetch with nothing cached is «no connection», never «no groups».
  const semLigacao = inbox.isError && inbox.data === undefined;
  const porResponder = convites.data ?? [];

  async function responder(acao: () => Promise<void>) {
    setErro(null);
    try {
      await acao();
      void refrescarAmigos();
      void refrescarGrupos();
    } catch (problema) {
      setErro(
        problema instanceof FriendRefused && problema.reason === 'group_full'
          ? 'Esse grupo já tem 100 pessoas, o máximo.'
          : 'Não deu para responder ao convite. Tenta outra vez.'
      );
    }
  }

  const abrir = (grupoId: string) =>
    router.push({ pathname: '/grupos/[grupoId]', params: { grupoId } });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={paginaRef}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: insets.bottom + BottomTabInset + Spacing.four }}
        refreshControl={
          userId ? (
            <RefreshControl
              refreshing={puxar.refreshing}
              onRefresh={puxar.onRefresh}
              progressViewOffset={insets.top}
              tintColor={theme.accentText}
            />
          ) : undefined
        }>
        <View style={[styles.relvadoAcima, { backgroundColor: theme.accent }]} pointerEvents="none" />
        <CabecalhoRelvado title="Malta" eyebrow="A tua gente dos jogos" />

        <View style={[styles.largura, styles.conteudo]}>
          {!userId ? (
            <EmptyState
              icon={icons.perfil}
              title="A malta precisa de conta"
              message="Os grupos juntam pessoas reais: entra para criares o teu e falares com quem vai contigo."
              action={{ label: 'Entrar', onPress: () => router.push('/conta/entrar') }}
            />
          ) : (
            <>
              {porResponder.length > 0 ? (
                <View style={styles.bloco}>
                  <SectionHeader title="Convites" contagem={porResponder.length} />
                  {porResponder.map((convite) => (
                    <Card key={convite.groupId} style={styles.convite}>
                      <ThemedText style={styles.negrito}>{convite.groupName}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {[
                          convite.invitedByName ? `${convite.invitedByName} convidou-te` : 'Convite',
                          plural(convite.members, 'pessoa', 'pessoas'),
                        ].join(' · ')}
                      </ThemedText>
                      <Button
                        label="Entrar no grupo"
                        icon={icons.perfil}
                        onPress={() => void responder(() => acceptGroupInvite(convite.groupId))}
                      />
                      <LinkTexto
                        neutro
                        label="Agora não"
                        onPress={() => void responder(() => declineGroupInvite(convite.groupId))}
                      />
                    </Card>
                  ))}
                </View>
              ) : null}

              {erro ? <MensagemErro>{erro}</MensagemErro> : null}

              <View style={styles.bloco}>
                {inbox.isLoading ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : semLigacao ? (
                  <EmptyState
                    icon={icons.erro}
                    title="Sem ligação"
                    message="Puxa para baixo para tentar outra vez."
                    action={{
                      label: 'Tentar outra vez',
                      onPress: () => void Promise.all([refrescarGrupos(), refrescarAmigos()]),
                    }}
                  />
                ) : grupos.length === 0 ? (
                  <Card style={styles.convite}>
                    <ThemedText type="subtitle">Ainda sem malta</ThemedText>
                    <ThemedText themeColor="textSecondary">
                      Cria um grupo para a malta do costume e manda-lhes o link.
                    </ThemedText>
                  </Card>
                ) : (
                  grupos.map((grupo) => (
                    <CartaoDoGrupo key={grupo.id} grupo={grupo} onPress={() => abrir(grupo.id)} />
                  ))
                )}
              </View>

              <Button
                label="Criar um grupo"
                icon={icons.perfil}
                variant={grupos.length === 0 && !semLigacao ? 'primary' : 'secondary'}
                onPress={() => router.push('/malta/novo')}
              />
              <EntrarComCodigo />
            </>
          )}
        </View>
      </ScrollView>
      {voltarAoTopo}
    </View>
  );
}

function CartaoDoGrupo({ grupo, onPress }: { grupo: GroupInboxItem; onPress: () => void }) {
  const theme = useTheme();
  const porLer = grupo.unread > 0;
  const ultima = resumo(grupo);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${grupo.name}${ultima ? `. ${ultima}` : ''}${porLer ? `. ${plural(grupo.unread, 'mensagem por ler', 'mensagens por ler')}` : ''}.`}
      style={({ pressed }) => [
        styles.cartao,
        CardShadow,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.premido,
      ]}>
      <CaraDoGrupo nome={grupo.name} url={grupo.photoUrl} size={44} />
      <View style={styles.meio}>
        <View style={styles.linha}>
          <ThemedText numberOfLines={1} style={[styles.flex, styles.nome]}>
            {grupo.name}
          </ThemedText>
          {grupo.last ? (
            <ThemedText type="small" themeColor={porLer ? 'accentInk' : 'textMuted'}>
              {quando(grupo.last.at)}
            </ThemedText>
          ) : null}
        </View>
        {ultima ? (
          <View style={styles.linha}>
            <ThemedText
              type="small"
              numberOfLines={1}
              themeColor={porLer ? 'text' : 'textSecondary'}
              style={styles.flex}>
              {ultima}
            </ThemedText>
            {porLer ? (
              <View style={[styles.porLer, { backgroundColor: theme.accent }]}>
                <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                  {grupo.unread > 99 ? '99+' : String(grupo.unread)}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  relvadoAcima: {
    position: 'absolute',
    top: -1000,
    left: 0,
    right: 0,
    height: 1000,
  },
  largura: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  conteudo: {
    gap: Spacing.four,
    paddingTop: 22,
    paddingHorizontal: MARGEM,
  },
  bloco: {
    gap: Spacing.twoAndHalf,
  },
  convite: {
    gap: Spacing.two,
  },
  negrito: {
    fontWeight: 700,
  },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.twoAndHalf,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  premido: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  meio: {
    flex: 1,
    gap: 2,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  nome: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 700,
  },
  porLer: {
    minWidth: 22,
    minHeight: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
