import { useRouter } from 'expo-router';
import { useState } from 'react';

import { AuthForm } from '@/features/auth/components/AuthForm';
import { authErrorMessage } from '@/features/auth/errors';
import { useSignUp } from '@/features/auth/hooks/useAuthActions';
import { closeAccountFlow } from '@/features/auth/navigation';
import {
  DISPLAY_NAME_MAX_LENGTH,
  displayNameError,
  emailError,
  normalizeEmail,
  PASSWORD_MAX_LENGTH,
  passwordError,
} from '@/features/auth/validation';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

export default function CriarContaScreen() {
  const router = useRouter();
  const criar = useSignUp();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tentou, setTentou] = useState(false);

  const erros = {
    nome: tentou ? displayNameError(nome) : null,
    email: tentou ? emailError(email) : null,
    password: tentou ? passwordError(password) : null,
  };

  function submeter() {
    setTentou(true);
    if (displayNameError(nome) || emailError(email) || passwordError(password) || criar.isPending) {
      return;
    }
    criar.mutate(
      { email, password, displayName: nome },
      {
        onSuccess: ({ needsEmailConfirmation }) => {
          if (needsEmailConfirmation) {
            router.push({ pathname: '/conta/confirmar-email', params: { email: normalizeEmail(email) } });
          } else {
            closeAccountFlow(router);
          }
        },
      }
    );
  }

  return (
    <AuthForm
      intro="Com conta, os teus clubes e o teu passaporte ficam guardados."
      error={criar.error ? authErrorMessage(criar.error) : null}>
      <Campo
        label="Como te chamamos"
        value={nome}
        onChangeText={setNome}
        erro={erros.nome}
        ajuda="É o que os outros adeptos veem."
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="nickname"
        returnKeyType="next"
      />
      <Campo
        label="Email"
        value={email}
        onChangeText={setEmail}
        erro={erros.email}
        ajuda="Serve só para entrares. Ninguém mais o vê."
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <Campo
        label="Password"
        value={password}
        onChangeText={setPassword}
        erro={erros.password}
        ajuda="Pelo menos 8 caracteres, com letras e números."
        maxLength={PASSWORD_MAX_LENGTH}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submeter}
      />
      <Button
        label={criar.isPending ? 'A criar conta…' : 'Criar conta'}
        onPress={submeter}
        disabled={criar.isPending}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Os outros adeptos só veem o teu nome e o clube que apoias. O clube da terra fica só para ti.
      </ThemedText>
      <LinkTexto label="Já tens conta? Entra" onPress={() => router.replace('/conta/entrar')} />
    </AuthForm>
  );
}
