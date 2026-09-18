import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
} from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import {
  clearProfilePhoto,
  ProfileRefused,
  saveProfilePhoto,
  setDisplayName,
  setHomeCity,
} from '@/features/profile/api';
import { useMyProfile } from '@/features/profile/hooks/useMyProfile';
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

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof ProfileRefused)) return 'Não deu para guardar. Tenta outra vez.';
  switch (erro.reason) {
    case 'bad_name':
      return 'O nome tem de ter entre 2 e 40 letras.';
    case 'bad_city':
      return 'Escreve o nome da terra com pelo menos 2 letras.';
    case 'rate_limited':
      return 'Já mudaste o nome vezes que chegue esta semana.';
    default:
      return 'Não deu para guardar. Tenta outra vez.';
  }
}

/**
 * O teu perfil: a foto, o nome e a terra.
 *
 * A foto é vista por quem tem conta — é o que ajuda quem está a pensar entrar no teu carro. Não é pública na
 * internet e ninguém é obrigado a ter uma: sem foto ficam as iniciais, como sempre foi.
 */
export default function EditarPerfilScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const perfil = useMyProfile(userId);

  const [nome, setNome] = useState<string | null>(null);
  const [cidade, setCidade] = useState<string | null>(null);
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
  const cidadeAtual = cidade ?? dados?.homeCity ?? '';

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
    if (daCamara) {
      if (Platform.OS === 'web') {
        Alert.alert('Sem câmara', 'Tira a foto no telemóvel, ou escolhe uma da galeria.');
        return;
      }
      const permissao = await requestCameraPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert('Sem câmara', 'Dá acesso à câmara nas definições para tirares a foto.', [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Abrir definições', onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
    }

    const resultado = daCamara
      ? await launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        })
      : await launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });
    const foto = resultado.canceled ? undefined : resultado.assets[0];
    if (!foto || !userId) return;

    await tratar(async () => {
      await saveProfilePhoto(userId, { uri: foto.uri, mimeType: foto.mimeType ?? 'image/jpeg' });
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
            label="Tirar a foto"
            onPress={() =>
              Alert.alert('Tirar a foto?', 'Voltas a aparecer com as tuas iniciais.', [
                { text: 'Deixa estar', style: 'cancel' },
                {
                  text: 'Tirar',
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
          ajuda="É este o nome que aparece nas boleias, nos grupos e nas contas."
        />
        <Button
          label="Guardar o nome"
          disabled={aTratar || nomeAtual.trim().length < 2 || nomeAtual === dados?.displayName}
          onPress={() => void tratar(() => setDisplayName(nomeAtual), 'Nome guardado.')}
        />
      </Card>

      <SectionHeader title="De onde és" />
      <Card style={styles.cartao}>
        <Campo
          label="A tua terra"
          value={cidadeAtual}
          onChangeText={setCidade}
          placeholder="Ex.: Viseu"
          maxLength={60}
          ajuda="Ajuda quem vê a tua boleia a perceber de onde sais. Podes deixar em branco."
        />
        <Button
          label="Guardar a terra"
          disabled={aTratar || cidadeAtual === (dados?.homeCity ?? '')}
          onPress={() => void tratar(() => setHomeCity(cidadeAtual), 'Terra guardada.')}
        />
      </Card>

      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}
      {guardado ? <ThemedText style={{ color: theme.successText }}>{guardado}</ThemedText> : null}

      <ThemedText type="small" themeColor="textMuted">
        O que os outros veem de ti: o nome, a foto, a terra, desde quando tens conta e as boleias
        que fizeste. Nunca o email nem onde estás.
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
