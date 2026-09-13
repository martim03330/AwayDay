import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ListaClubeDaTerra } from '@/components/lista-clube-terra';
import { OnboardingPasso } from '@/components/onboarding-passo';
import { obterClube } from '@/mocks/clubes';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';

export default function OnboardingClubeDaTerraScreen() {
  const router = useRouter();
  const { clubeDaTerraId, confirmarClubeDaTerra } = useAppState();
  // As sugestões nunca vêm pré-selecionadas: só a escolha já confirmada.
  const [selecionadoId, setSelecionadoId] = useState<string | null>(clubeDaTerraId);
  const selecionado = selecionadoId ? obterClube(selecionadoId) : undefined;

  function seguir() {
    router.push('/onboarding/permissoes');
  }

  return (
    <OnboardingPasso
      passo={2}
      frase="E ao pé de casa, quem é que joga?"
      rodape={
        <>
          <Button
            label={selecionado ? `Confirmar ${selecionado.nomeCurto}` : 'Escolhe um clube ou salta'}
            disabled={!selecionado}
            onPress={() => {
              if (!selecionado) return;
              confirmarClubeDaTerra(selecionado.id);
              seguir();
            }}
          />
          <Button label="Saltar" variant="secondary" onPress={seguir} />
        </>
      }>
      <ListaClubeDaTerra selecionadoId={selecionadoId} onSelecionar={setSelecionadoId} />
    </OnboardingPasso>
  );
}
