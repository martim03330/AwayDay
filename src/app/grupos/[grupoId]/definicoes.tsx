import { useQueryClient } from '@tanstack/react-query';
import { launchImageLibraryAsync } from 'expo-image-picker';
import * as Linking from 'expo-linking';
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
import { useProfileCards } from '@/features/profile/hooks/useMyProfile';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { Avatar } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
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
    const link = Linking.createURL('/grupos/entrar', { queryParams: { code: grupo.inviteCode } });
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
        text: 'Tirar a foto',
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
        <ThemedText type="title" style={styles.centrado}>
          {grupo.name}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {plural(grupo.members, 'pessoa', 'pessoas')}
        </ThemedText>
      </View>

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
      <ThemedText type="small" themeColor="textMuted">
        O fundo é do grupo: muda para toda a malta.
      </ThemedText>

      <SectionHeader title="Convidar" />
      <Card style={styles.grupo}>
        <ThemedText themeColor="textSecondary">
          Manda o link a quem quiseres. Quem o abrir entra no grupo — por isso manda-o só a quem
          queres mesmo lá dentro.
        </ThemedText>
        <Button
          label="Partilhar o link do grupo"
          icon={icons.partilhar}
          onPress={() => void convidar()}
        />
        {souDono ? (
          <LinkTexto
            label="Trocar o link (o antigo deixa de servir)"
            onPress={() =>
              void tratar(async () => {
                await rotateGroupInvite(grupo.id);
              })
            }
          />
        ) : null}
      </Card>

      {porConvidar.length > 0 ? (
        <>
          <SectionHeader title="Convidar amigos" />
          <Card style={styles.grupo}>
            <ThemedText themeColor="textSecondary">
              O convite fica à espera que a pessoa aceite — ninguém entra num grupo sem querer.
            </ThemedText>
            {porConvidar.map((amigo) => (
              <LinhaGrupo
                key={amigo.profileId}
                leading={<IconCircle name={icons.perfil} tone="neutral" />}
                title={amigo.displayName}
                subtitle={
                  amigo.tripsTogether > 0
                    ? plural(amigo.tripsTogether, 'viagem juntos', 'viagens juntos')
                    : 'ainda sem viagens juntos'
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
        </>
      ) : null}

      <SectionHeader title="Quem está no grupo" trailing={String(lista.length)} />
      {lista.map((pessoa) => {
        const cartao = (cartoes.data ?? []).find((c) => c.profileId === pessoa.profileId);
        return (
          <Card key={pessoa.profileId} style={styles.grupo}>
            <View style={styles.linha}>
              <Avatar nome={pessoa.displayName} url={cartao?.avatarUrl} />
              <View style={styles.flex}>
                <ThemedText style={styles.nome} numberOfLines={1}>
                  {pessoa.isMine ? `${pessoa.displayName} (tu)` : pessoa.displayName}
                </ThemedText>
                <ThemedText type="small" themeColor="textMuted">
                  {[cartao?.homeCity, sinais(pessoa)].filter(Boolean).join(' · ')}
                </ThemedText>
              </View>
              {pessoa.role === 'owner' ? (
                <Etiqueta icon={icons.selecionado} label="Dono" tone="neutro" />
              ) : null}
            </View>
            {souDono && !pessoa.isMine ? (
              <LinkTexto
                perigo
                label="Tirar do grupo"
                onPress={() => void tratar(() => removeGroupMember(grupo.id, pessoa.profileId))}
              />
            ) : null}
          </Card>
        );
      })}

      {souDono ? (
        <>
          <SectionHeader title="Nome do grupo" />
          <Card style={styles.grupo}>
            {aMudarNome ? (
              <>
                <Campo
                  label="Novo nome"
                  value={nome}
                  onChangeText={setNome}
                  placeholder={grupo.name}
                  maxLength={60}
                />
                <Button
                  label="Guardar"
                  disabled={aTratar}
                  onPress={() =>
                    void tratar(() => renameGroup(grupo.id, nome)).then((mudou) => {
                      if (mudou) setAMudarNome(false);
                    })
                  }
                />
                <LinkTexto neutro label="Deixa estar" onPress={() => setAMudarNome(false)} />
              </>
            ) : (
              <LinkTexto
                label="Mudar o nome"
                onPress={() => {
                  setNome(grupo.name);
                  setAMudarNome(true);
                }}
              />
            )}
          </Card>
        </>
      ) : null}

      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}

      <Card style={styles.grupo}>
        <LinkTexto perigo label="Sair do grupo" onPress={sair} />
      </Card>

      <ThemedText type="small" themeColor="textMuted">
        A foto e o fundo só são vistos por quem está no grupo. A app não move dinheiro nenhum: só
        diz quem paga a quem.
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
  grupo: {
    gap: Spacing.two,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  nome: {
    fontWeight: 700,
  },
});
