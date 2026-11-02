import { useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useRequestSupportersClub } from '@/features/casas/hooks/useCasas';
import { mensagemDaGestao } from '@/features/casas/mensagens';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/session';
import { vibrarErro, vibrarSucesso } from '@/lib/vibrar';
import { obterClube } from '@/mocks/clubes';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Escudo } from '@/ui/escudo';
import { Icon, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { MensagemErro } from '@/ui/mensagem-erro';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

type Escolha = (valor: string | null, onChange: (id: string) => void) => ReactNode;

/**
 * «Registar a minha Casa»: someone from the Casa's board asks, with their own account. The request waits for an
 * administrator, who confirms it with the Casa; until then the Casa cannot publish trips. The club and concelho
 * pickers come from the screen (they are shared app components).
 */
export function RegistarCasa({
  clubeInicial,
  escolherClube,
  escolherConcelho,
  onRegistada,
  onTenhoCodigo,
  onVoltar,
}: {
  /** The club the person supports, preselected. */
  clubeInicial: string | null;
  escolherClube: Escolha;
  escolherConcelho: Escolha;
  onRegistada: (casaId: string) => void;
  onTenhoCodigo: () => void;
  onVoltar: () => void;
}) {
  const theme = useTheme();
  const userId = useUserId();
  const pedir = useRequestSupportersClub();
  const [clubeId, setClubeId] = useState<string | null>(clubeInicial);
  const [aEscolherClube, setAEscolherClube] = useState(clubeInicial === null);
  const [nome, setNome] = useState('');
  const [concelho, setConcelho] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  if (!userId) {
    return (
      <EmptyState
        icon={icons.perfil}
        title="Precisas de conta"
        message="Entra com a tua conta para registar a Casa."
        action={{ label: 'Voltar', onPress: onVoltar }}
      />
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
          onRegistada(casaId);
        },
        onError: (problema) => {
          vibrarErro();
          setErro(mensagemDaGestao(problema));
        },
      }
    );
  }

  return (
    <>
      <ThemedText themeColor="textSecondary">
        Para a Casa publicar viagens, confirmamos primeiro com a direção. Quem pede fica como dono e pode convidar
        outros gestores, cada um com a sua conta.
      </ThemedText>

      <SectionHeader title="Clube" />
      <Card style={aEscolherClube || !clube ? styles.cartao : styles.lista}>
        {aEscolherClube || !clube ? (
          escolherClube(clubeId, (id) => {
            setClubeId(id);
            setAEscolherClube(false);
          })
        ) : (
          <LinhaGrupo
            onPress={() => setAEscolherClube(true)}
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
      <Card style={styles.cartao}>{escolherConcelho(concelho, setConcelho)}</Card>

      {erro ? <MensagemErro>{erro}</MensagemErro> : null}
      <Button
        label={pedir.isPending ? 'A enviar…' : 'Pedir registo'}
        icon={icons.casa}
        disabled={!pronto || pedir.isPending}
        onPress={enviar}
      />
      <LinkTexto neutro label="Tenho um código de gestor" onPress={onTenhoCodigo} />
    </>
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
