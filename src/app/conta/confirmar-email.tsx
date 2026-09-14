import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AuthForm } from '@/features/auth/components/AuthForm';
import { authErrorMessage } from '@/features/auth/errors';
import { useResendSignUpCode, useVerifySignUpCode } from '@/features/auth/hooks/useAuthActions';
import { useCloseAccountFlow } from '@/features/auth/hooks/useCloseAccountFlow';
import { codeError } from '@/features/auth/validation';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

export default function ConfirmarEmailScreen() {
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const verificar = useVerifySignUpCode();
  const reenviar = useResendSignUpCode();
  const { onboardingConcluido } = useAppState();
  const fecharConta = useCloseAccountFlow(onboardingConcluido);
  const [codigo, setCodigo] = useState('');
  const [tentou, setTentou] = useState(false);

  const erroPedido = verificar.error ?? reenviar.error;
  const aConfirmar = verificar.isPending || verificar.isSuccess;

  function submeter() {
    setTentou(true);
    if (codeError(codigo) || aConfirmar) return;
    verificar.mutate({ email, code: codigo }, { onSuccess: fecharConta });
  }

  return (
    <AuthForm
      intro={`Enviámos um código de 6 algarismos para ${email}. Pode demorar um minuto a chegar: espreita também o spam.`}
      error={erroPedido ? authErrorMessage(erroPedido) : null}
      notice={reenviar.isSuccess ? 'Enviámos outro código.' : null}>
      <Campo
        label="Código"
        value={codigo}
        onChangeText={setCodigo}
        erro={tentou ? codeError(codigo) : null}
        keyboardType="number-pad"
        maxLength={7}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus
        returnKeyType="go"
        onSubmitEditing={submeter}
      />
      <Button
        label={aConfirmar ? 'A confirmar…' : 'Confirmar'}
        onPress={submeter}
        disabled={aConfirmar}
      />
      <LinkTexto
        label={reenviar.isPending ? 'A enviar…' : 'Não chegou? Reenviar código'}
        onPress={() => reenviar.mutate(email)}
        disabled={reenviar.isPending}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Se já tinhas conta com este email, não chega código nenhum: entra com a tua password.
      </ThemedText>
    </AuthForm>
  );
}
