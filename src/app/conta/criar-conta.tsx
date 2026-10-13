import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { ConsentimentoTermos } from '@/components/consentimento-termos';
import { isNameAllowed } from '@/features/auth/api';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { authErrorMessage } from '@/features/auth/errors';
import { useSignUp } from '@/features/auth/hooks/useAuthActions';
import { useCloseAccountFlow } from '@/features/auth/hooks/useCloseAccountFlow';
import {
  DISPLAY_NAME_MAX_LENGTH,
  displayNameError,
  emailError,
  normalizeEmail,
  PASSWORD_MAX_LENGTH,
  passwordError,
} from '@/features/auth/validation';
import { VERSAO_DOS_TERMOS } from '@/lib/legal';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

export default function CriarContaScreen() {
  const router = useRouter();
  const criar = useSignUp();
  const fecharConta = useCloseAccountFlow();
  const [nome, setNome] = useState('');
  const campoEmail = useRef<TextInput>(null);
  const campoPassword = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tentou, setTentou] = useState(false);
  const [aceitou, setAceitou] = useState(false);
  /** Email que já tem conta: em vez de pedir um código que nunca chega, propõe entrar. */
  const [emailComConta, setEmailComConta] = useState<string | null>(null);
  /** The name the server refused (a swear word or a slur), until it is changed. */
  const [nomeRecusado, setNomeRecusado] = useState<string | null>(null);
  const [aVerificarNome, setAVerificarNome] = useState(false);

  const erros = {
    nome: tentou
      ? (displayNameError(nome) ?? (nomeRecusado === nome ? 'Escolhe outro nome: este não pode ser.' : null))
      : null,
    email: tentou ? emailError(email) : null,
    password: tentou ? passwordError(password) : null,
    termos: tentou && !aceitou ? 'Para criar conta tens de aceitar os termos e a política de privacidade.' : null,
  };
  const erroPedido = criar.error
    ? authErrorMessage(criar.error)
    : emailComConta
      ? 'Já existe uma conta com este email. Entra ou recupera a palavra-passe.'
      : null;

  function mudarEmail(texto: string) {
    setEmail(texto);
    setEmailComConta(null);
  }

  async function submeter() {
    setTentou(true);
    if (
      displayNameError(nome) ||
      emailError(email) ||
      passwordError(password) ||
      !aceitou ||
      criar.isPending ||
      aVerificarNome
    ) {
      return;
    }
    setAVerificarNome(true);
    const permitido = await isNameAllowed(nome).finally(() => setAVerificarNome(false));
    if (!permitido) {
      setNomeRecusado(nome);
      return;
    }
    const emailNormalizado = normalizeEmail(email);
    criar.mutate(
      { email, password, displayName: nome, termsVersion: VERSAO_DOS_TERMOS },
      {
        onSuccess: (resultado) => {
          if (resultado === 'already-registered') {
            setEmailComConta(emailNormalizado);
          } else if (resultado === 'needs-confirmation') {
            router.push({ pathname: '/conta/confirmar-email', params: { email: emailNormalizado } });
          } else {
            fecharConta();
          }
        },
      }
    );
  }

  return (
    <AuthForm
      intro="Com conta, os teus clubes e o teu passaporte ficam guardados."
      error={erroPedido}>
      {emailComConta ? (
        <>
          <Button
            label="Entrar com este email"
            variant="secondary"
            onPress={() =>
              router.replace({ pathname: '/conta/entrar', params: { email: emailComConta } })
            }
          />
          <LinkTexto
            label="Esqueceste a palavra-passe? Recupera-a"
            onPress={() =>
              router.push({ pathname: '/conta/recuperar-password', params: { email: emailComConta } })
            }
          />
        </>
      ) : null}
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
        onSubmitEditing={() => campoEmail.current?.focus()}
      />
      <Campo
        ref={campoEmail}
        label="Email"
        value={email}
        onChangeText={mudarEmail}
        erro={erros.email}
        ajuda="Serve só para entrares. Ninguém mais o vê."
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
        erro={erros.password}
        ajuda="Pelo menos 8 caracteres, com letras e números."
        maxLength={PASSWORD_MAX_LENGTH}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void submeter()}
      />
      <ConsentimentoTermos aceite={aceitou} onMudar={setAceitou} erro={erros.termos} />
      <Button
        label={criar.isPending || aVerificarNome ? 'A criar conta…' : 'Criar conta'}
        onPress={() => void submeter()}
        disabled={criar.isPending || aVerificarNome}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Os outros adeptos só veem o teu nome, a foto e o clube que apoias.
      </ThemedText>
      <LinkTexto label="Já tens conta? Entra" onPress={() => router.replace('/conta/entrar')} />
    </AuthForm>
  );
}
