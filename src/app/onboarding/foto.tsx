import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { OnboardingPasso } from '@/components/onboarding-passo';
import { Spacing } from '@/constants/theme';
import { saveProfilePhoto } from '@/features/profile/api';
import { useMyProfile } from '@/features/profile/hooks/useMyProfile';
import { useEscolherFotoPerfil } from '@/hooks/use-escolher-foto-perfil';
import { useTheme } from '@/hooks/use-theme';
import { passoSeguinte, posicaoNaIntroducao } from '@/lib/introducao';
import { useUserId } from '@/lib/session';
import { Avatar } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Icon, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

const PASSO = 'foto';

/** Primeiro passo com conta: uma cara. Opcional — sem foto ficam as iniciais. */
export default function OnboardingFotoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  const escolherFoto = useEscolherFotoPerfil();
  const [aGuardar, setAGuardar] = useState(false);
  const { passo, total } = posicaoNaIntroducao(PASSO, true);
  const temFoto = Boolean(perfil.data?.avatarUrl);

  function seguir() {
    router.push(`/onboarding/${passoSeguinte(PASSO, true) ?? 'avisos'}`);
  }

  async function guardar(daCamara: boolean) {
    const foto = await escolherFoto(daCamara);
    if (!foto || !userId) return;
    setAGuardar(true);
    try {
      await saveProfilePhoto(userId, foto);
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    } catch {
      Alert.alert('A foto não ficou guardada', 'Verifica a ligação e tenta outra vez.');
    } finally {
      setAGuardar(false);
    }
  }

  function perguntarDeOnde() {
    Alert.alert('A tua foto', undefined, [
      { text: 'Tirar uma foto', onPress: () => void guardar(true) },
      { text: 'Escolher da galeria', onPress: () => void guardar(false) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  return (
    <OnboardingPasso
      passo={passo}
      total={total}
      frase="Mostra a cara à malta."
      rodape={
        <>
          <Button label="Continuar" variant="highlight" disabled={!temFoto || aGuardar} onPress={seguir} />
          <LinkTexto neutro label="Faço isto depois" onPress={seguir} />
        </>
      }>
      <ThemedText themeColor="textSecondary">
        Para te reconhecerem no ponto de encontro, no carro e à porta do tasco. Só quem tem conta a
        vê.
      </ThemedText>

      <Pressable
        onPress={perguntarDeOnde}
        disabled={aGuardar}
        accessibilityRole="button"
        accessibilityLabel={temFoto ? 'Mudar a foto' : 'Escolher foto'}
        style={({ pressed }) => [styles.foto, pressed && styles.premido]}>
        <View>
          <Avatar nome={perfil.data?.displayName ?? 'Adepto'} url={perfil.data?.avatarUrl} size={150} />
          <View style={[styles.camara, { backgroundColor: theme.accent, borderColor: theme.background }]}>
            <Icon name={icons.camara} size={20} color={theme.accentText} />
          </View>
        </View>
        <ThemedText type="smallBold" themeColor="accentInk" style={styles.acao}>
          {aGuardar ? 'A guardar…' : temFoto ? 'Mudar a foto' : 'Escolher foto'}
        </ThemedText>
      </Pressable>
    </OnboardingPasso>
  );
}

const styles = StyleSheet.create({
  foto: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  camara: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acao: {
    fontSize: 16,
  },
  premido: {
    opacity: 0.7,
  },
});
