import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { AuthForm } from '@/features/auth/components/AuthForm';
import { SocialSignIn } from '@/features/auth/components/SocialSignIn';
import { authErrorCode, authErrorMessage } from '@/features/auth/errors';
import { useResendSignUpCode, useSignIn } from '@/features/auth/hooks/useAuthActions';
import { useCloseAccountFlow } from '@/features/auth/hooks/useCloseAccountFlow';
import { emailError, normalizeEmail } from '@/features/auth/validation';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { LinkTexto } from '@/ui/link-texto';

export default function EntrarScreen() {
  const router = useRouter();
  // Vem preenchido quando se chega aqui a partir de "Já existe uma conta com este email".
  const params = useLocalSearchParams<{ email?: string }>();
  const entrar = useSignIn();
  const reenviarCodigo = useResendSignUpCode();
  const fecharConta = useCloseAccountFlow();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const campoPassword = useRef<TextInput>(null);
  const [tentou, setTentou] = useState(false);
  /** Error from «Continuar com Apple / Google». */
  const [erroSocial, setErroSocial] = useState<string | null>(null);

  const erroEmail = tentou ? emailError(email) : null;
  const erroPassword = tentou && !password ? 'Falta a palavra-passe.' : null;
  // Conta por confirmar não é um erro para mostrar aqui: segue para o ecrã do código.
  const erroPedido =
    entrar.error && authErrorCode(entrar.error) !== 'email_not_confirmed'
      ? authErrorMessage(entrar.error)
      : null;

  function submeter() {
    setTentou(true);
    setErroSocial(null);
    if (emailError(email) || !password || entrar.isPending || entrar.isSuccess) return;
    entrar.mutate(
      { email, password },
      {
        onSuccess: fecharConta,
        onError: (erro) => {
          if (authErrorCode(erro) !== 'email_not_confirmed') return;
          reenviarCodigo.mutate(email);
          router.push({ pathname: '/conta/confirmar-email', params: { email: normalizeEmail(email) } });
        },
      }
    );
  }

  return (
    <AuthForm intro="Entra para os teus clubes e o teu passaporte virem contigo." error={erroSocial ?? erroPedido}>
      <SocialSignIn onSignedIn={fecharConta} onError={setErroSocial} />
      <Campo
        label="Email"
        value={email}
        onChangeText={setEmail}
        erro={erroEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => campoPassword.current?.focus()}
      />
      <Campo
        ref={campoPassword}
        label="Palavra-passe"
        value={password}
        onChangeText={setPassword}
        erro={erroPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submeter}
      />
      <Button
        label={entrar.isPending || entrar.isSuccess ? 'A entrar…' : 'Entrar'}
        onPress={submeter}
        disabled={entrar.isPending || entrar.isSuccess}
      />
      <LinkTexto
        label="Esqueceste a palavra-passe?"
        onPress={() =>
          router.push({ pathname: '/conta/recuperar-password', params: { email: normalizeEmail(email) } })
        }
      />
      <LinkTexto
        label="Ainda não tens conta? Cria uma"
        onPress={() => router.replace('/conta/criar-conta')}
      />
    </AuthForm>
  );
}
