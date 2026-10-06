import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { EscolherTransporte } from '@/components/escolher-transporte';
import { OnboardingPasso } from '@/components/onboarding-passo';
import { useMyHome, useSaveMyHome } from '@/features/profile/hooks/useMyProfile';
import type { UsualTransport } from '@/features/profile/types';
import { passoSeguinte, posicaoNaIntroducao } from '@/lib/introducao';
import { useUserId } from '@/lib/session';
import { Button } from '@/ui/button';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

const PASSO = 'transporte';

/** Como costumas ir aos jogos. Só muda o que aparece primeiro; nada fica escondido. */
export default function OnboardingTransporteScreen() {
  const router = useRouter();
  const userId = useUserId();
  const casa = useMyHome(userId);
  const guardar = useSaveMyHome(userId);
  const [escolhido, setEscolhido] = useState<UsualTransport | null>(null);
  const { passo, total } = posicaoNaIntroducao(PASSO, true);
  const valor = escolhido ?? casa.data?.usualTransport ?? null;

  function seguir() {
    router.push(`/onboarding/${passoSeguinte(PASSO, true) ?? 'avisos'}`);
  }

  function continuar() {
    if (!valor) return;
    guardar.mutate(
      { usualTransport: valor },
      {
        onSuccess: seguir,
        onError: () => Alert.alert('Não ficou guardado', 'Verifica a ligação e tenta outra vez.'),
      }
    );
  }

  return (
    <OnboardingPasso
      passo={passo}
      total={total}
      frase="Como costumas ir à bola?"
      rodape={
        <>
          <Button
            label="Continuar"
            variant="highlight"
            disabled={!valor || guardar.isPending}
            onPress={continuar}
          />
          <LinkTexto neutro label="Faço isto depois" onPress={seguir} />
        </>
      }>
      <ThemedText themeColor="textSecondary">
        Escolhe o que fazes mais vezes. Muda só o que aparece primeiro, e podes mudar no perfil.
      </ThemedText>
      <EscolherTransporte valor={valor} onChange={setEscolhido} />
    </OnboardingPasso>
  );
}
