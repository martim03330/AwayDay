import { useLocalSearchParams, useRouter } from 'expo-router';

import { PaginaDaCasa } from '@/features/casas/components/PaginaDaCasa';
import { BotaoMais, useModeracao } from '@/features/moderation/components/Moderacao';
import { Screen } from '@/ui/screen';

/** A Casa's page: opened from one of its trips, or from the profile by its managers. */
export default function CasaScreen() {
  const { casaId } = useLocalSearchParams<{ casaId?: string }>();
  const router = useRouter();
  const moderacao = useModeracao();

  return (
    <Screen>
      {moderacao.elemento}
      {casaId ? (
        <PaginaDaCasa
          casaId={casaId}
          onAbrirViagem={(viagemId) =>
            router.push({ pathname: '/casa/viagem/[viagemId]', params: { viagemId } })
          }
          onNovaViagem={() => router.push({ pathname: '/casa/[casaId]/nova-viagem', params: { casaId } })}
          onGestores={() => router.push({ pathname: '/casa/[casaId]/gestores', params: { casaId } })}
          onTenhoCodigo={() => router.push('/casa/entrar')}
          renderMais={(nome) => (
            <BotaoMais
              nome={nome}
              onPress={() => moderacao.abrirConteudo({ kind: 'supporters_club', targetId: casaId, nome })}
            />
          )}
        />
      ) : null}
    </Screen>
  );
}
