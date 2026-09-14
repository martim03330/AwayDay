import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { AuthForm } from '@/features/auth/components/AuthForm';
import { authErrorMessage } from '@/features/auth/errors';
import { useResetPassword } from '@/features/auth/hooks/useAuthActions';
import { useCloseAccountFlow } from '@/features/auth/hooks/useCloseAccountFlow';
import { codeError, PASSWORD_MAX_LENGTH, passwordError } from '@/features/auth/validation';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { ThemedText } from '@/ui/themed-text';

export default function NovaPasswordScreen() {
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const mudar = useResetPassword();
  const { onboardingConcluido } = useAppState();
  const fecharConta = useCloseAccountFlow(onboardingConcluido);
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [tentou, setTentou] = useState(false);
  const aGuardar = mudar.isPending || mudar.isSuccess;

  function submeter() {
    setTentou(true);
    if (codeError(codigo) || passwordError(password) || aGuardar) return;
    mudar.mutate(
      { email, code: codigo, password },
      {
        onSuccess: () => {
          fecharConta();
          Alert.alert('Password mudada', 'Já estás dentro, com a password nova.');
        },
      }
    );
  }

  return (
    <AuthForm
      intro={`Escreve o código que enviámos para ${email} e escolhe a password nova.`}
      error={mudar.error ? authErrorMessage(mudar.error) : null}>
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
        returnKeyType="next"
      />
      <Campo
        label="Password nova"
        value={password}
        onChangeText={setPassword}
        erro={tentou ? passwordError(password) : null}
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
        label={aGuardar ? 'A guardar…' : 'Guardar password'}
        onPress={submeter}
        disabled={aGuardar}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Se não houver conta com este email, não chega código nenhum.
      </ThemedText>
    </AuthForm>
  );
}
