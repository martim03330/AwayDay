import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FundoEstadio } from '@/components/fundo-estadio';
import { Colors, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { ThemedText } from '@/ui/themed-text';

/**
 * Boas-vindas: a primeira coisa que se vê. Criar conta ou entrar leva aos passos do perfil (foto, clube, de onde
 * partes, como vais). Não há forma de usar a app sem conta.
 */
export default function BoasVindasScreen() {
  const router = useRouter();
  const sessao = useSession();
  const { onboardingConcluido } = useAppState();
  const contasDisponiveis = supabase !== null;

  // Back from signing in or creating an account (the modal closed): carry on with the profile steps. Only while this
  // screen is in front, so nothing moves underneath the modal. Someone who already did the introduction (they signed
  // out and are back) goes straight to the tabs: the root navigation takes care of that.
  useFocusEffect(
    useCallback(() => {
      if (sessao.status === 'signed-in' && !onboardingConcluido) router.replace('/onboarding/foto');
    }, [sessao.status, onboardingConcluido, router])
  );

  return (
    <FundoEstadio>
      <ThemedText type="eyebrow" style={styles.marca}>
        AwayDay
      </ThemedText>

      <View style={styles.espaco} />

      <View style={styles.botoes}>
        <ThemedText type="title" style={styles.titulo} accessibilityRole="header">
          Vamos à bola?
        </ThemedText>
        <ThemedText style={styles.subtitulo}>
          Quem leva o carro, onde se come antes e como se volta. Combina tudo com a tua malta.
        </ThemedText>
        {contasDisponiveis ? (
          <View style={styles.contas}>
            <View style={styles.flex}>
              <Button
                label="Criar conta"
                variant="highlight"
                onPress={() => router.push('/conta/criar-conta')}
              />
            </View>
            <View style={styles.flex}>
              <Button
                label="Já tenho conta"
                variant="secondary"
                onPress={() => router.push('/conta/entrar')}
              />
            </View>
          </View>
        ) : null}
        {/* The app is used with an account. Only a build without Supabase (development) starts without one. */}
        {contasDisponiveis ? null : (
          <Pressable
            onPress={() => router.push('/onboarding/clube')}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.explorar, pressed && styles.premido]}>
            <ThemedText style={styles.explorarTexto}>Começar</ThemedText>
          </Pressable>
        )}
        <View style={styles.legal}>
          <ThemedText
            style={styles.legalTexto}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/legal/[documento]', params: { documento: 'termos' } })}>
            Termos
          </ThemedText>
          <ThemedText style={styles.legalTexto} accessible={false}>
            ·
          </ThemedText>
          <ThemedText
            style={styles.legalTexto}
            accessibilityRole="link"
            onPress={() =>
              router.push({ pathname: '/legal/[documento]', params: { documento: 'privacidade' } })
            }>
            Privacidade
          </ThemedText>
        </View>
      </View>
    </FundoEstadio>
  );
}

const styles = StyleSheet.create({
  marca: {
    color: Colors.highlight,
  },
  espaco: {
    flex: 1,
  },
  titulo: {
    fontSize: 64,
    lineHeight: 64,
    color: Colors.accentText,
  },
  subtitulo: {
    fontSize: 18,
    lineHeight: 25,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  botoes: {
    gap: Spacing.three,
  },
  contas: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  explorar: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  explorarTexto: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 700,
    color: Colors.accentText,
  },
  premido: {
    opacity: 0.6,
  },
  legal: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  legalTexto: {
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: Spacing.one,
    color: 'rgba(255, 255, 255, 0.75)',
  },
});
