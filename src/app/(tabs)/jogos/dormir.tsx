import { useLocalSearchParams, useRouter } from 'expo-router';

import { DormidaCard } from '@/components/dormida-card';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';

/** Dormir fora: quem propõe casa, quem se junta, e a pesquisa com as noites já preenchidas. */
export default function DormirScreen() {
  const router = useRouter();
  // Vindo de um plano: a casa nasce do grupo, o formulário abre logo (`propor`) e a pesquisa é para quem disse «vou»
  // (`pessoas`), em vez de perguntar quanto cada um quer pagar.
  const { jogoId, grupoId, propor, pessoas } = useLocalSearchParams<{
    jogoId?: string;
    grupoId?: string;
    propor?: string;
    pessoas?: string;
  }>();
  const pessoasDoGrupo = pessoas && /^\d+$/.test(pessoas) ? Number(pessoas) : null;
  const jogo = jogoId ? obterJogo(jogoId) : undefined;
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;

  if (!jogo || !estadio) {
    return (
      <Screen>
        <EmptyState
          icon={icons.casa}
          title="Jogo não encontrado"
          message="Volta aos jogos e tenta outra vez."
          action={{ label: 'Voltar aos jogos', onPress: () => router.replace('/jogos') }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader title="Onde dormir" />
      <DormidaCard
        jogo={jogo}
        estadio={estadio}
        grupoInicial={grupoId ?? null}
        abrirLogo={propor === '1'}
        pessoasDoGrupo={pessoasDoGrupo}
      />
    </Screen>
  );
}
