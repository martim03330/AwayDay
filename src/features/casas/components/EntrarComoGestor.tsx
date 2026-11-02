import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAcceptSupportersClubInvite } from '@/features/casas/hooks/useCasas';
import { mensagemDaGestao } from '@/features/casas/mensagens';
import { useUserId } from '@/lib/session';
import { vibrarErro, vibrarSucesso } from '@/lib/vibrar';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { MensagemErro } from '@/ui/mensagem-erro';
import { ThemedText } from '@/ui/themed-text';

/** A manager's invite code: whoever writes it starts managing that Casa with their own account. */
export function EntrarComoGestor({
  onEntrou,
  onVoltar,
}: {
  onEntrou: (casaId: string) => void;
  onVoltar: () => void;
}) {
  const userId = useUserId();
  const aceitar = useAcceptSupportersClubInvite();
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  if (!userId) {
    return (
      <EmptyState
        icon={icons.perfil}
        title="Precisas de conta"
        message="Entra com a tua conta para gerir a Casa."
        action={{ label: 'Voltar', onPress: onVoltar }}
      />
    );
  }

  const limpo = codigo.trim().toLowerCase();

  function enviar() {
    setErro(null);
    aceitar.mutate(limpo, {
      onSuccess: (casaId) => {
        vibrarSucesso();
        onEntrou(casaId);
      },
      onError: (problema) => {
        vibrarErro();
        setErro(mensagemDaGestao(problema));
      },
    });
  }

  return (
    <Card style={styles.cartao}>
      <ThemedText themeColor="textSecondary">
        O dono da Casa cria o código no ecrã dos gestores. Serve uma vez e dura 7 dias.
      </ThemedText>
      <Campo
        label="Código de gestor"
        value={codigo}
        onChangeText={setCodigo}
        maxLength={20}
        autoCapitalize="none"
        autoComplete="off"
        placeholder="Ex.: k3m9q2x7ab"
        returnKeyType="done"
        onSubmitEditing={() => {
          if (limpo.length > 0 && !aceitar.isPending) enviar();
        }}
      />
      {erro ? <MensagemErro>{erro}</MensagemErro> : null}
      <Button
        label={aceitar.isPending ? 'A entrar…' : 'Entrar'}
        disabled={limpo.length === 0 || aceitar.isPending}
        onPress={enviar}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.three,
  },
});
