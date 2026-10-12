import { useRouter } from 'expo-router';
import { useState } from 'react';

import { OnboardingPasso } from '@/components/onboarding-passo';
import { ListaDeClubes } from '@/components/lista-de-clubes';
import { passoSeguinte, posicaoNaIntroducao } from '@/lib/introducao';
import { useSession } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { LinkTexto } from '@/ui/link-texto';

export default function OnboardingClubeScreen() {
  const router = useRouter();
  const { clubeFavoritoId, escolherClube } = useAppState();
  // Na primeira vez nada vem escolhido; ao rever a introdução, mostra a escolha atual.
  const [selecionadoId, setSelecionadoId] = useState<string | null>(clubeFavoritoId);
  const selecionado = selecionadoId ? obterClube(selecionadoId) : undefined;
  const comConta = useSession().status === 'signed-in';
  const { passo, total } = posicaoNaIntroducao('clube', comConta);

  function seguir() {
    // The clube da terra step is out for now (MOSTRAR_CLUBE_DA_TERRA).
    router.push(`/onboarding/${passoSeguinte('clube', comConta) ?? 'avisos'}`);
  }

  return (
    <OnboardingPasso
      passo={passo}
      total={total}
      frase="Primeiro o mais importante: de que clube és?"
      rodape={
        <>
          <Button
            label={selecionado ? `Continuar com ${selecionado.nomeCurto}` : 'Escolhe o teu clube'}
            variant="highlight"
            disabled={!selecionado}
            onPress={() => {
              if (!selecionado) return;
              escolherClube(selecionado.id);
              seguir();
            }}
          />
          <LinkTexto neutro label="Faço isto depois" onPress={seguir} />
        </>
      }>
      <ListaDeClubes selecionadoId={selecionadoId} onEscolher={setSelecionadoId} />
    </OnboardingPasso>
  );
}

