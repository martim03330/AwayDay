import { useRouter } from 'expo-router';

import { EscolherConcelho } from '@/components/escolher-concelho';
import { ListaDeClubes } from '@/components/lista-de-clubes';
import { RegistarCasa } from '@/features/casas/components/RegistarCasa';
import { useMunicipalities } from '@/features/profile/hooks/useMyProfile';
import { useUserId } from '@/lib/session';
import { useAppState } from '@/state/app-state';
import { Screen } from '@/ui/screen';
import { ThemedText } from '@/ui/themed-text';

/** «Registar a minha Casa», from the profile. */
export default function RegistarCasaScreen() {
  const router = useRouter();
  const userId = useUserId();
  const { clubeFavoritoId } = useAppState();
  const municipios = useMunicipalities(userId !== null);

  return (
    <Screen>
      <RegistarCasa
        clubeInicial={clubeFavoritoId}
        escolherClube={(valor, onChange) => <ListaDeClubes selecionadoId={valor} onEscolher={onChange} />}
        escolherConcelho={(valor, onChange) =>
          municipios.data && municipios.data.length > 0 ? (
            <EscolherConcelho municipios={municipios.data} valor={valor} onChange={onChange} />
          ) : (
            <ThemedText type="small" themeColor="textMuted">
              A lista de concelhos está a carregar.
            </ThemedText>
          )
        }
        onRegistada={(casaId) => router.replace({ pathname: '/casa/[casaId]', params: { casaId } })}
        onTenhoCodigo={() => router.push('/casa/entrar')}
        onVoltar={() => router.back()}
      />
    </Screen>
  );
}
