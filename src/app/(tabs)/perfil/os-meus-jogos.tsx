import { useRouter } from 'expo-router';

import { JogoCard } from '@/components/jogo-card';
import { useJogosAQueFoste } from '@/hooks/use-jogos-a-que-foste';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { useAppState } from '@/state/app-state';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';

/** The user's history: finished games they went to. Games they skipped are not listed. */
export default function OsMeusJogosScreen() {
  const router = useRouter();
  const userId = useUserId();
  const { avaliacaoDoJogo } = useAppState();
  const { historico, aCarregar } = useJogosAQueFoste();

  if (aCarregar && historico.length === 0) {
    return (
      <Screen>
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </Screen>
    );
  }

  if (historico.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={icons.acesso}
          title="Ainda sem jogos"
          message={
            userId
              ? 'Marca "Vou a este jogo" antes do apito e o jogo fica aqui depois de terminar.'
              : 'Os jogos que avaliares ficam aqui. Com conta, também guardamos os jogos a que vais.'
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader title="Já foste a" trailing={plural(historico.length, 'jogo', 'jogos')} />
      {historico.map((jogo) => (
        <JogoCard
          key={jogo.id}
          jogo={jogo}
          estado="terminado"
          avaliacao={avaliacaoDoJogo(jogo.id)}
          onPress={() => router.push({ pathname: '/jogos/[jogoId]', params: { jogoId: jogo.id } })}
        />
      ))}
    </Screen>
  );
}
