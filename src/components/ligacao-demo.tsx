import * as Linking from 'expo-linking';
import { useEffect, useRef } from 'react';

import { eFaseDiaDeJogo } from '@/lib/relogio';
import { JOGO_DEMO_POR_OMISSAO } from '@/mocks/demo';
import { obterJogo } from '@/mocks/jogos';
import { useAppState } from '@/state/app-state';
import { useRelogio } from '@/state/relogio';

/**
 * Qualquer página ou app pode abrir um deep link: fora do desenvolvimento, só builds com
 * `EXPO_PUBLIC_DEMO_MODE=true` o aceitam. O Modo demo do Perfil funciona sempre.
 */
const LIGACAO_DEMO_ATIVA = __DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

/**
 * Deep link de demo: `?demoFase=almoco|check-in|a-caminho|a-decorrer|depois|real&jogo=<id>`.
 * Muda a hora da app para essa fase e salta o onboarding, para se poder testar sem tocar no ecrã.
 */
export function LigacaoDemo() {
  const url = Linking.useURL();
  const processado = useRef<string | null>(null);
  const { simularFase, usarHoraReal } = useRelogio();
  const { saltarOnboarding, modoDemo, alternarModoDemo } = useAppState();

  useEffect(() => {
    if (!LIGACAO_DEMO_ATIVA || !url || processado.current === url) return;
    processado.current = url;

    const { queryParams } = Linking.parse(url);
    const fase = queryParams?.demoFase;
    if (typeof fase !== 'string') return;

    saltarOnboarding();
    if (fase === 'real') {
      usarHoraReal();
      return;
    }
    if (!eFaseDiaDeJogo(fase)) return;
    // Simulated time only makes sense with demo data: never mix it with the user's real activity.
    if (!modoDemo) alternarModoDemo();

    const jogoId = typeof queryParams?.jogo === 'string' ? queryParams.jogo : JOGO_DEMO_POR_OMISSAO;
    const jogo = obterJogo(jogoId);
    if (jogo) simularFase(jogo, fase);
  }, [url, saltarOnboarding, simularFase, usarHoraReal, modoDemo, alternarModoDemo]);

  return null;
}
