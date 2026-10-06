import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { EscolherConcelho } from '@/components/escolher-concelho';
import { OnboardingPasso } from '@/components/onboarding-passo';
import { useMunicipalities, useMyHome, useSaveMyHome } from '@/features/profile/hooks/useMyProfile';
import { passoSeguinte, posicaoNaIntroducao } from '@/lib/introducao';
import { useUserId } from '@/lib/session';
import { Button } from '@/ui/button';
import { LinkTexto } from '@/ui/link-texto';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

const PASSO = 'zona';

/**
 * De onde partes para os jogos: o concelho, nada mais fino. Serve para pôr primeiro as boleias que saem perto.
 * Só tu o vês.
 */
export default function OnboardingZonaScreen() {
  const router = useRouter();
  const userId = useUserId();
  const municipios = useMunicipalities();
  const casa = useMyHome(userId);
  const guardar = useSaveMyHome(userId);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const { passo, total } = posicaoNaIntroducao(PASSO, true);
  const valor = escolhido ?? casa.data?.municipalityId ?? null;
  const nome = municipios.data?.find((municipio) => municipio.id === valor)?.name;

  function seguir() {
    router.push(`/onboarding/${passoSeguinte(PASSO, true) ?? 'avisos'}`);
  }

  function continuar() {
    if (!valor) return;
    guardar.mutate(
      { municipalityId: valor },
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
      frase="De onde partes para os jogos?"
      rodape={
        <>
          <Button
            label={nome ? `Continuar com ${nome}` : 'Escolhe o teu concelho'}
            variant="highlight"
            disabled={!valor || guardar.isPending}
            onPress={continuar}
          />
          <LinkTexto neutro label="Faço isto depois" onPress={seguir} />
        </>
      }>
      <ThemedText themeColor="textSecondary">
        Pomos primeiro as boleias que saem perto de ti. Guardamos só o concelho, nunca a morada, e
        mais ninguém o vê. Podes mudar no perfil.
      </ThemedText>
      {municipios.isLoading ? (
        <SkeletonCard />
      ) : municipios.data && municipios.data.length > 0 ? (
        <EscolherConcelho municipios={municipios.data} valor={valor} onChange={setEscolhido} />
      ) : (
        <ThemedText themeColor="textSecondary">
          A lista de concelhos não carregou. Podes saltar e escolher depois, no perfil.
        </ThemedText>
      )}
    </OnboardingPasso>
  );
}
