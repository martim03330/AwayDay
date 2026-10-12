import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { NoAccountForEmail } from '@/features/auth/api';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { authErrorMessage } from '@/features/auth/errors';
import { useRequestPasswordReset } from '@/features/auth/hooks/useAuthActions';
import { emailError, normalizeEmail } from '@/features/auth/validation';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { LinkTexto } from '@/ui/link-texto';

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

  // No account with this email: said under the field, in red, with a way to create one.
  const semConta = pedir.error instanceof NoAccountForEmail;

  function mudarEmail(texto: string) {
    setEmail(texto);
    if (pedir.error) pedir.reset();
  }

  return (
    <AuthForm
      intro="Diz-nos o teu email e enviamos um código para escolheres uma password nova."
      error={pedir.error && !semConta ? authErrorMessage(pedir.error) : null}>
      <Campo
        label="Email"
        value={email}
        onChangeText={mudarEmail}
        erro={
          semConta
            ? 'Não há nenhuma conta com este email.'
            : tentou
              ? emailError(email)
              : null
        }
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
      {semConta ? (
        <LinkTexto
          label="Criar conta com este email"
          onPress={() => router.replace('/conta/criar-conta')}
        />
      ) : null}
    </AuthForm>
  );
}
