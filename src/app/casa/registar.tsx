import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { EscolherConcelho } from '@/components/escolher-concelho';
import { ListaDeClubes } from '@/components/lista-de-clubes';
import { Spacing } from '@/constants/theme';
import { useRequestSupportersClub } from '@/features/casas/hooks/useCasas';
import { mensagemDaGestao } from '@/features/casas/mensagens';
import { useMunicipalities } from '@/features/profile/hooks/useMyProfile';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/session';
import { vibrarErro, vibrarSucesso } from '@/lib/vibrar';
import { obterClube } from '@/mocks/clubes';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Escudo } from '@/ui/escudo';
import { Icon, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { MensagemErro } from '@/ui/mensagem-erro';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

/**
 * «Registar a minha Casa»: someone from the Casa's board asks, with their own account. The request waits for an
 * administrator, who confirms it with the Casa; until then the Casa cannot publish trips.
 */
export default function RegistarCasaScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const { clubeFavoritoId } = useAppState();
  const municipios = useMunicipalities(userId !== null);
  const pedir = useRequestSupportersClub();
  const [clubeId, setClubeId] = useState<string | null>(clubeFavoritoId);
  const [escolherClube, setEscolherClube] = useState(clubeFavoritoId === null);
  const [nome, setNome] = useState('');
  const [concelho, setConcelho] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Precisas de conta"
          message="Entra com a tua conta para registar a Casa."
          action={{ label: 'Voltar', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const clube = obterClube(clubeId);
  const pronto = clubeId !== null && nome.trim().length >= 3 && concelho !== null;

  function enviar() {
    if (!clubeId || !concelho) return;
    setErro(null);
    pedir.mutate(
      {
        clubId: clubeId,
        name: nome.trim(),
        municipalityId: concelho,
        contactEmail: email.trim() === '' ? null : email.trim(),
      },
      {
        onSuccess: (casaId) => {
          vibrarSucesso();
          router.replace({ pathname: '/casa/[casaId]', params: { casaId } });
        },
        onError: (problema) => {
          vibrarErro();
          setErro(mensagemDaGestao(problema));
        },
      }
    );
  }

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">
        Para a Casa publicar viagens, confirmamos primeiro com a direção. Quem pede fica como dono e pode convidar
        outros gestores, cada um com a sua conta.
      </ThemedText>

      <SectionHeader title="Clube" />
      <Card style={escolherClube ? styles.cartao : styles.lista}>
        {escolherClube || !clube ? (
          <ListaDeClubes
            selecionadoId={clubeId}
            onEscolher={(id) => {
              setClubeId(id);
              setEscolherClube(false);
            }}
          />
        ) : (
          <LinhaGrupo
            onPress={() => setEscolherClube(true)}
            accessibilityLabel={`Clube: ${clube.nomeCurto}. Toca para mudar.`}
            leading={<Escudo clube={clube} size={36} />}
            title={clube.nomeCurto}
            trailing={<Icon name={icons.editar} size={18} color={theme.textMuted} />}
          />
        )}
      </Card>

      <SectionHeader title="A Casa" />
      <Card style={styles.cartao}>
        <Campo
          label="Nome da Casa"
          value={nome}
          onChangeText={setNome}
          maxLength={80}
          autoCapitalize="words"
          placeholder="Ex.: Casa do clube em Viseu"
        />
        <Campo
          label="Email da Casa (opcional)"
          value={email}
          onChangeText={setEmail}
          maxLength={254}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="Ex.: geral@casadoclube.pt"
          ajuda="O email oficial ajuda-nos a confirmar a Casa."
        />
      </Card>

      <SectionHeader title="Concelho" />
      <Card style={styles.cartao}>
        {municipios.data && municipios.data.length > 0 ? (
          <EscolherConcelho municipios={municipios.data} valor={concelho} onChange={setConcelho} />
        ) : (
          <ThemedText type="small" themeColor="textMuted">
            A lista de concelhos está a carregar.
          </ThemedText>
        )}
      </Card>

      {erro ? <MensagemErro>{erro}</MensagemErro> : null}
      <Button
        label={pedir.isPending ? 'A enviar…' : 'Pedir registo'}
        icon={icons.casa}
        disabled={!pronto || pedir.isPending}
        onPress={enviar}
      />
      <LinkTexto neutro label="Tenho um código de gestor" onPress={() => router.push('/casa/entrar')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.three,
  },
  lista: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
});
