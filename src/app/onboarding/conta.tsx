import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingPasso } from '@/components/onboarding-passo';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { IconCircle, icons, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

const VANTAGENS: readonly { icon: IconName; title: string; subtitle: string }[] = [
  {
    icon: icons.visitado,
    title: 'Os teus clubes ficam guardados',
    subtitle: 'Mudas de telemóvel e continuam lá.',
  },
  {
    icon: icons.perfil,
    title: 'O email é só para entrares',
    subtitle: 'Os outros adeptos veem o teu nome e o clube que apoias. Mais nada.',
  },
  {
    icon: icons.introducao,
    title: 'Sem pressa',
    subtitle: 'Podes criar conta mais tarde, no Perfil.',
  },
];

export default function OnboardingContaScreen() {
  const router = useRouter();
  const theme = useTheme();
  const sessao = useSession();
  const { permissoes, concluirOnboarding } = useAppState();
  const concluido = useRef(false);
  const contasDisponiveis = supabase !== null;

  // Quem entra ou cria conta a partir daqui acaba a introdução logo a seguir.
  useEffect(() => {
    if (sessao.status !== 'signed-in' || concluido.current) return;
    concluido.current = true;
    concluirOnboarding(permissoes);
  }, [sessao.status, permissoes, concluirOnboarding]);

  function continuarSemConta() {
    if (concluido.current) return;
    concluido.current = true;
    concluirOnboarding(permissoes);
  }

  return (
    <OnboardingPasso
      passo={3}
      frase="Guarda o teu passaporte: com conta, os teus clubes vêm contigo para qualquer telemóvel."
      rodape={
        <View style={styles.botoes}>
          {contasDisponiveis ? (
            <>
              <Button
                label="Criar conta"
                icon={icons.perfil}
                variant="highlight"
                onPress={() => router.push('/conta/criar-conta')}
              />
              <Button
                label="Já tenho conta"
                variant="secondary"
                onPress={() => router.push('/conta/entrar')}
              />
            </>
          ) : null}
          <Button
            label={contasDisponiveis ? 'Agora não' : 'Bora lá'}
            icon={contasDisponiveis ? undefined : icons.jogos}
            variant={contasDisponiveis ? 'secondary' : 'highlight'}
            onPress={continuarSemConta}
          />
        </View>
      }>
      <Card style={styles.cartao}>
        {VANTAGENS.map((vantagem, indice) => (
          <View
            key={vantagem.title}
            style={[styles.linha, indice > 0 && { borderTopWidth: 1, borderTopColor: theme.backgroundSelected }]}>
            <IconCircle name={vantagem.icon} />
            <View style={styles.flex}>
              <ThemedText style={styles.titulo}>{vantagem.title}</ThemedText>
              <ThemedText style={styles.subtitulo} themeColor="textSecondary">
                {vantagem.subtitle}
              </ThemedText>
            </View>
          </View>
        ))}
      </Card>
    </OnboardingPasso>
  );
}

const styles = StyleSheet.create({
  botoes: {
    gap: Spacing.two,
  },
  cartao: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
  },
  flex: {
    flex: 1,
    gap: 1,
  },
  titulo: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 800,
  },
  subtitulo: {
    fontSize: 13,
    lineHeight: 18,
  },
});
