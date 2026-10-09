import { useQueryClient } from '@tanstack/react-query';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { inviteFriendToGroup } from '@/features/friends/api';
import { useMyFriends } from '@/features/friends/hooks/useFriends';
import {
  FUNDOS,
  GroupRefused,
  leaveGroup,
  removeGroupMember,
  renameGroup,
  rotateGroupInvite,
  saveGroupBackground,
  saveGroupPhoto,
  type GroupMember,
} from '@/features/groups/api';
import { CaraDoGrupo } from '@/features/groups/components/CaraDoGrupo';
import { AmostraDeFundo, NOMES_DOS_FUNDOS } from '@/features/groups/components/FundoConversa';
import { useGroupFromInbox, useGroupMembers } from '@/features/groups/hooks/useGroups';
import { BotaoMais, useModeracao } from '@/features/moderation/components/Moderacao';
import { useProfileCards } from '@/features/profile/hooks/useMyProfile';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { Avatar } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof GroupRefused)) return 'Não deu para fazer isso. Tenta outra vez.';
  switch (erro.reason) {
    case 'not_owner':
      return 'Só quem criou o grupo é que pode fazer isso.';
    case 'not_member':
      return 'Já não estás neste grupo.';
    case 'bad_name':
      return 'O nome do grupo tem de ter entre 2 e 60 letras.';
    case 'own_membership':
      return 'Para saíres do grupo usa «Sair do grupo».';
    default:
      return 'Não deu para fazer isso. Tenta outra vez.';
  }
}

/** "na app desde setembro de 2026 · 3 boleias": o que a app sabe mesmo de cada um. */
function sinais(pessoa: GroupMember) {
  const desde = pessoa.memberSince
    ? new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(
        new Date(pessoa.memberSince)
      )
    : null;
  return [
    desde ? `na app desde ${desde}` : null,
    plural(pessoa.ridesCompleted, 'boleia', 'boleias'),
    pessoa.ridesFaults > 0 ? plural(pessoa.ridesFaults, 'falta', 'faltas') : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Uma foto da galeria, ou nada se a pessoa desistir. */
async function escolherDaGaleria(aspeto: [number, number]) {
  const resultado = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: aspeto,
    quality: 0.7,
  });
  const foto = resultado.canceled ? undefined : resultado.assets[0];
  return foto ? { uri: foto.uri, mimeType: foto.mimeType ?? 'image/jpeg' } : null;
}

/** O grupo por dentro: a cara, o fundo da conversa, quem lá está, o convite e o que só o dono pode mudar. */
export default function DefinicoesDoGrupoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { grupoId } = useLocalSearchParams<{ grupoId?: string }>();

  const { group: grupo, isLoading } = useGroupFromInbox(grupoId ?? null, userId !== null);
  const membros = useGroupMembers(grupo ? grupo.id : null);
  const amigos = useMyFriends(userId !== null);
  const cartoes = useProfileCards((membros.data ?? []).map((pessoa) => pessoa.profileId));
  const moderacao = useModeracao();

  const [convidados, setConvidados] = useState<string[]>([]);
  const [nome, setNome] = useState('');
  const [aMudarNome, setAMudarNome] = useState(false);
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!grupo) {
    return (
      <Screen>
        {isLoading ? (
          <ThemedText themeColor="textSecondary">A abrir o grupo…</ThemedText>
        ) : (
          <EmptyState
            icon={icons.naoEncontrado}
            title="Já não estás neste grupo"
            message="Podes ter saído, ou alguém pode ter-te tirado."
            action={{ label: 'Voltar à Malta', onPress: () => router.replace('/malta') }}
          />
        )}
      </Screen>
    );
  }

  const souDono = grupo.role === 'owner';
  const lista = membros.data ?? [];
  const porConvidar = (amigos.data ?? []).filter(
    (amigo) => !lista.some((pessoa) => pessoa.profileId === amigo.profileId)
  );

  async function tratar(acao: () => Promise<void>) {
    setErro(null);
    setATratar(true);
    try {
      await acao();
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      return true;
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
      return false;
    } finally {
      setATratar(false);
    }
  }

  const convidar = async () => {
    // An https page (it opens the app, or shows the code and how to install): WhatsApp does not make awayday:// tappable.
    const link = `https://martim03330.github.io/awayday-legal/convite/?c=${encodeURIComponent(grupo.inviteCode)}`;
    await Share.share({
      message: `Anda para o grupo "${grupo.name}" no AwayDay: ${link}`,
    }).catch(() => undefined);
  };

  const mudarCara = () => {
    const opcoes: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      {
        text: 'Escolher da galeria',
        onPress: () =>
          void escolherDaGaleria([1, 1]).then((foto) => {
            if (foto) void tratar(() => saveGroupPhoto(grupo, foto));
          }),
      },
    ];
    if (grupo.photoUrl) {
      opcoes.push({
        text: 'Remover a foto',
        style: 'destructive',
        onPress: () => void tratar(() => saveGroupPhoto(grupo, null)),
      });
    }
    opcoes.push({ text: 'Deixa estar', style: 'cancel' });
    Alert.alert('A cara do grupo', 'Toda a malta do grupo vê esta foto.', opcoes);
  };

  const escolherFundoDaGaleria = () =>
    void escolherDaGaleria([9, 16]).then((foto) => {
      if (foto) void tratar(() => saveGroupBackground(grupo, { kind: 'foto', ...foto }));
    });

  const sair = () => {
    const alvo = grupo.id;
    Alert.alert(
      'Sair do grupo?',
      souDono
        ? 'O grupo fica com o membro mais antigo. Se fores o último, o grupo acaba.'
        : 'Deixas de ver o que a malta combinar por aqui.',
      [
        { text: 'Ficar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () =>
            void tratar(() => leaveGroup(alvo)).then((saiu) => {
              if (saiu) router.dismissTo('/malta');
            }),
        },
      ]
    );
  };

  const guardarNome = () =>
    void tratar(() => renameGroup(grupo.id, nome)).then((mudou) => {
      if (mudou) setAMudarNome(false);
    });

  return (
    <Screen>
      <View style={styles.topo}>
        <Pressable
          onPress={mudarCara}
          disabled={aTratar}
          accessibilityRole="button"
          accessibilityLabel="Mudar a foto do grupo">
          <CaraDoGrupo nome={grupo.name} url={grupo.photoUrl} size={96} />
          <View style={[styles.camara, { backgroundColor: theme.accent }]}>
            <Icon name={icons.camara} size={16} color={theme.accentText} />
          </View>
        </Pressable>
        {aMudarNome ? (
          <View style={styles.novoNome}>
            <Campo
              label="Nome do grupo"
              value={nome}
              onChangeText={setNome}
              placeholder={grupo.name}
              maxLength={60}
              autoFocus
              onSubmitEditing={guardarNome}
            />
            <View style={styles.botoesNome}>
              <LinkTexto neutro label="Deixa estar" onPress={() => setAMudarNome(false)} />
              <LinkTexto label="Guardar" disabled={aTratar} onPress={guardarNome} />
            </View>
          </View>
        ) : (
          <>
            <ThemedText type="title" style={styles.centrado}>
              {grupo.name}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {plural(grupo.members, 'pessoa', 'pessoas')}
            </ThemedText>
            {souDono ? (
              <LinkTexto
                label="Mudar o nome"
                onPress={() => {
                  setNome(grupo.name);
                  setAMudarNome(true);
                }}
              />
            ) : null}
          </>
        )}
      </View>

      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}

      <SectionHeader title="Quem está no grupo" trailing={String(lista.length)} />
      <Card style={styles.lista}>
        {lista.map((pessoa, indice) => {
          const cartao = (cartoes.data ?? []).find((c) => c.profileId === pessoa.profileId);
          return (
            <LinhaGrupo
              key={pessoa.profileId}
              separador={indice < lista.length - 1}
              leading={<Avatar nome={pessoa.displayName} url={cartao?.avatarUrl} />}
              title={pessoa.isMine ? `${pessoa.displayName} (tu)` : pessoa.displayName}
              subtitle={[pessoa.role === 'owner' ? 'Dono' : null, sinais(pessoa)].filter(Boolean).join(' · ') || undefined}
              trailing={
                pessoa.isMine ? undefined : (
                  // Everything about someone else sits behind one discreet «⋯»: report, block and, for the
                  // owner, taking them out of the group.
                  <BotaoMais
                    nome={pessoa.displayName}
                    onPress={() =>
                      moderacao.abrirPessoa({
                        pessoa: { profileId: pessoa.profileId, nome: pessoa.displayName },
                        temFoto: Boolean(cartao?.avatarUrl),
                        extras: souDono
                          ? [
                              {
                                label: 'Tirar do grupo',
                                destrutiva: true,
                                onPress: () =>
                                  Alert.alert(`Tirar ${pessoa.displayName} do grupo?`, undefined, [
                                    { text: 'Deixa estar', style: 'cancel' },
                                    {
                                      text: 'Tirar',
                                      style: 'destructive',
                                      onPress: () =>
                                        void tratar(() =>
                                          removeGroupMember(grupo.id, pessoa.profileId)
                                        ),
                                    },
                                  ]),
                              },
                            ]
                          : [],
                      })
                    }
                  />
                )
              }
            />
          );
        })}
      </Card>

      <SectionHeader title="Convidar" />
      <Button label="Partilhar o link do grupo" icon={icons.partilhar} onPress={() => void convidar()} />
      {porConvidar.length > 0 ? (
        <Card style={styles.lista}>
          {porConvidar.map((amigo, indice) => (
            <LinhaGrupo
              key={amigo.profileId}
              separador={indice < porConvidar.length - 1}
              leading={<IconCircle name={icons.perfil} tone="neutral" />}
              title={amigo.displayName}
              subtitle={
                amigo.tripsTogether > 0
                  ? plural(amigo.tripsTogether, 'viagem juntos', 'viagens juntos')
                  : 'Teu amigo'
              }
              trailing={
                <LinkTexto
                  label={convidados.includes(amigo.profileId) ? 'Convidado' : 'Convidar'}
                  onPress={() => {
                    if (convidados.includes(amigo.profileId)) return;
                    void tratar(() => inviteFriendToGroup(grupo.id, amigo.profileId)).then(
                      (feito) => {
                        if (feito) setConvidados((atuais) => [...atuais, amigo.profileId]);
                      }
                    );
                  }}
                />
              }
            />
          ))}
        </Card>
      ) : null}
      <ThemedText type="small" themeColor="textMuted">
        Quem abrir o link entra no grupo: manda-o só a quem queres lá dentro. Os amigos recebem um
        convite e escolhem se entram.
      </ThemedText>
      {souDono ? (
        <LinkTexto
          neutro
          label="Trocar o link (o antigo deixa de servir)"
          onPress={() =>
            void tratar(async () => {
              await rotateGroupInvite(grupo.id);
            })
          }
        />
      ) : null}

      <SectionHeader title="Fundo da conversa" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.fundos}>
        {FUNDOS.map((fundo) => {
          const escolhido = grupo.fundo.kind === 'pronto' && grupo.fundo.fundo === fundo;
          return (
            <Pressable
              key={fundo}
              disabled={aTratar}
              onPress={() =>
                void tratar(() => saveGroupBackground(grupo, { kind: 'pronto', fundo }))
              }
              accessibilityRole="button"
              accessibilityState={{ selected: escolhido }}
              accessibilityLabel={`Fundo ${NOMES_DOS_FUNDOS[fundo]}`}
              style={styles.fundo}>
              <View
                style={[styles.moldura, { borderColor: escolhido ? theme.accent : 'transparent' }]}>
                <AmostraDeFundo fundo={fundo} />
              </View>
              <ThemedText type="small" themeColor={escolhido ? 'accentInk' : 'textSecondary'}>
                {NOMES_DOS_FUNDOS[fundo]}
              </ThemedText>
            </Pressable>
          );
        })}
        <Pressable
          disabled={aTratar}
          onPress={escolherFundoDaGaleria}
          accessibilityRole="button"
          accessibilityState={{ selected: grupo.fundo.kind === 'foto' }}
          accessibilityLabel="Usar uma foto da galeria como fundo"
          style={styles.fundo}>
          <View
            style={[
              styles.moldura,
              { borderColor: grupo.fundo.kind === 'foto' ? theme.accent : 'transparent' },
            ]}>
            <View style={[styles.fotoFundo, { backgroundColor: theme.backgroundSelected }]}>
              <Icon name={icons.album} size={22} color={theme.textSecondary} />
            </View>
          </View>
          <ThemedText
            type="small"
            themeColor={grupo.fundo.kind === 'foto' ? 'accentInk' : 'textSecondary'}>
            Uma foto
          </ThemedText>
        </Pressable>
      </ScrollView>

      <View style={styles.sair}>
        <LinkTexto perigo label="Sair do grupo" onPress={sair} />
        <LinkTexto
          neutro
          label="Denunciar o grupo"
          onPress={() => moderacao.denunciarGrupo(grupo.id, grupo.name)}
        />
      </View>
      {moderacao.elemento}
      <ThemedText type="small" themeColor="textMuted" style={styles.centrado}>
        A foto e o fundo só são vistos por quem está no grupo.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topo: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  centrado: {
    textAlign: 'center',
  },
  camara: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fundos: {
    gap: Spacing.twoAndHalf,
    paddingRight: Spacing.three,
  },
  fundo: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  moldura: {
    borderWidth: 2.5,
    borderRadius: 17,
    padding: 2,
  },
  fotoFundo: {
    width: 64,
    height: 90,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lista: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  novoNome: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  botoesNome: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.four,
  },
  sair: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
});
