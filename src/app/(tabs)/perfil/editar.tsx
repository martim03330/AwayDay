import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { EscolherConcelho } from '@/components/escolher-concelho';
import { EscolherTransporte } from '@/components/escolher-transporte';
import { Spacing } from '@/constants/theme';
import {
  clearProfilePhoto,
  ProfileRefused,
  saveProfilePhoto,
  setDisplayName,
} from '@/features/profile/api';
import {
  useMunicipalities,
  useMyHome,
  useMyProfile,
  useSaveMyHome,
} from '@/features/profile/hooks/useMyProfile';
import { useEscolherFotoPerfil } from '@/hooks/use-escolher-foto-perfil';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/session';
import { Avatar } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';
import { MensagemErro } from '@/ui/mensagem-erro';

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof ProfileRefused)) return 'Não deu para guardar. Tenta outra vez.';
  switch (erro.reason) {
    case 'bad_name':
      return 'O nome tem de ter entre 2 e 40 letras.';
    case 'rate_limited':
      return 'Já mudaste o nome vezes que chegue esta semana.';
    default:
      return 'Não deu para guardar. Tenta outra vez.';
  }
}

/**
 * O teu perfil: a foto, o nome, de onde partes para os jogos e como costumas ir.
 *
 * A foto é vista por quem tem conta — é o que ajuda quem está a pensar entrar no teu carro. Não é pública na
 * internet e ninguém é obrigado a ter uma: sem foto ficam as iniciais, como sempre foi.
 */
export default function EditarPerfilScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  const escolherFotoPerfil = useEscolherFotoPerfil();
  const municipios = useMunicipalities(userId !== null);
  const casa = useMyHome(userId);
  const guardarCasa = useSaveMyHome(userId);

  const [nome, setNome] = useState<string | null>(null);
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Precisas de conta"
          message="O perfil vive na tua conta."
          action={{ label: 'Entrar', onPress: () => router.push('/conta/entrar') }}
        />
      </Screen>
    );
  }

  const dados = perfil.data ?? null;
  const nomeAtual = nome ?? dados?.displayName ?? '';

  async function tratar(acao: () => Promise<void>, feito: string) {
    setErro(null);
    setGuardado(null);
    setATratar(true);
    try {
      await acao();
      await perfil.refetch();
      setGuardado(feito);
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    } finally {
      setATratar(false);
    }
  }

  async function escolherFoto(daCamara: boolean) {
    const foto = await escolherFotoPerfil(daCamara);
    if (!foto || !userId) return;

    await tratar(async () => {
      await saveProfilePhoto(userId, foto);
    }, 'Foto guardada.');
  }

  return (
    <Screen>
      <SectionHeader title="A tua foto" />
      <Card style={styles.cartao}>
        <View style={styles.foto}>
          <Avatar nome={nomeAtual || 'Adepto'} url={dados?.avatarUrl} size={96} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          A foto é vista por quem tem conta na app — nas boleias, nos grupos e nas contas das
          viagens. Não é pública na internet, e podes tirá-la quando quiseres.
        </ThemedText>
        <Button
          label="Tirar uma foto"
          icon={icons.camara}
          disabled={aTratar}
          onPress={() => void escolherFoto(true)}
        />
        <Button
          label="Escolher da galeria"
          variant="secondary"
          icon={icons.album}
          disabled={aTratar}
          onPress={() => void escolherFoto(false)}
        />
        {dados?.avatarUrl ? (
          <LinkTexto
            perigo
            label="Remover a foto"
            onPress={() =>
              Alert.alert('Remover a foto?', 'Voltas a aparecer com as tuas iniciais.', [
                { text: 'Deixa estar', style: 'cancel' },
                {
                  text: 'Remover',
                  style: 'destructive',
                  onPress: () => void tratar(() => clearProfilePhoto(userId), 'Já não tens foto.'),
                },
              ])
            }
          />
        ) : null}
      </Card>

      <SectionHeader title="O teu nome" />
      <Card style={styles.cartao}>
        <Campo
          label="Como te chamam"
          value={nomeAtual}
          onChangeText={setNome}
          placeholder="O teu nome"
          maxLength={40}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="nickname"
          returnKeyType="done"
          ajuda="É este o nome que aparece nas boleias, nos grupos e nas contas."
        />
        <Button
          label="Guardar o nome"
          disabled={aTratar || nomeAtual.trim().length < 2 || nomeAtual === dados?.displayName}
          onPress={() => void tratar(() => setDisplayName(nomeAtual), 'Nome guardado.')}
        />
      </Card>

      <SectionHeader title="De onde partes para os jogos" />
      <Card style={styles.cartao}>
        <ThemedText type="small" themeColor="textSecondary">
          Pomos primeiro as boleias que saem perto de ti. Só o concelho, e só tu o vês.
        </ThemedText>
        {municipios.data && municipios.data.length > 0 ? (
          <EscolherConcelho
            municipios={municipios.data}
            valor={casa.data?.municipalityId ?? null}
            onChange={(municipalityId) =>
              guardarCasa.mutate(
                { municipalityId },
                { onError: () => setErro('Não deu para guardar o concelho. Tenta outra vez.') }
              )
            }
          />
        ) : (
          <ThemedText type="small" themeColor="textMuted">
            A lista de concelhos está a carregar.
          </ThemedText>
        )}
      </Card>

      <SectionHeader title="Como costumas ir à bola" />
      <EscolherTransporte
        valor={casa.data?.usualTransport ?? null}
        onChange={(usualTransport) =>
          guardarCasa.mutate(
            { usualTransport },
            { onError: () => setErro('Não deu para guardar. Tenta outra vez.') }
          )
        }
      />

      {erro ? <MensagemErro>{erro}</MensagemErro> : null}
      {guardado ? <ThemedText style={{ color: theme.successText }}>{guardado}</ThemedText> : null}

      <ThemedText type="small" themeColor="textMuted">
        O que os outros veem de ti: o nome, a foto, desde quando tens conta e as boleias que
        fizeste. Nunca o email, o concelho de onde partes nem onde estás.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.two,
  },
  foto: {
    alignItems: 'center',
  },
});
