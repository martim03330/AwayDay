import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { AuthForm } from '@/features/auth/components/AuthForm';
import { authErrorMessage } from '@/features/auth/errors';
import { useRequestPasswordReset } from '@/features/auth/hooks/useAuthActions';
import { emailError, normalizeEmail } from '@/features/auth/validation';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';

export default function RecuperarPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const pedir = useRequestPasswordReset();
  const [email, setEmail] = useState(params.email ?? '');
  const [tentou, setTentou] = useState(false);

  function submeter() {
    setTentou(true);
    if (emailError(email) || pedir.isPending) return;
    pedir.mutate(email, {
      onSuccess: () =>
        router.push({ pathname: '/conta/nova-password', params: { email: normalizeEmail(email) } }),
    });
  }

  return (
    <AuthForm
      intro="Diz-nos o teu email e enviamos um código para escolheres uma password nova."
      error={pedir.error ? authErrorMessage(pedir.error) : null}>
      <Campo
        label="Email"
        value={email}
        onChangeText={setEmail}
        erro={tentou ? emailError(email) : null}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="go"
        onSubmitEditing={submeter}
      />
      <Button
        label={pedir.isPending ? 'A enviar…' : 'Enviar código'}
        onPress={submeter}
        disabled={pedir.isPending}
      />
    </AuthForm>
  );
}
