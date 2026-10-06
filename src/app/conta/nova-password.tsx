import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { AuthForm, CampoCodigo } from '@/features/auth/components/AuthForm';
import { authErrorMessage } from '@/features/auth/errors';
import { useResetPassword } from '@/features/auth/hooks/useAuthActions';
import { useCloseAccountFlow } from '@/features/auth/hooks/useCloseAccountFlow';
import { codeError, PASSWORD_MAX_LENGTH, passwordError } from '@/features/auth/validation';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

export default function NovaPasswordScreen() {
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const mudar = useResetPassword();
  const fecharConta = useCloseAccountFlow();
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
      hero={{ icon: icons.password, tag: '8 algarismos' }}
      intro={
        <>
          {'Escreve o código que enviámos para '}
          <ThemedText themeColor="text" style={styles.email}>
            {email}
          </ThemedText>
          {' e escolhe a password nova.'}
        </>
      }
      error={mudar.error ? authErrorMessage(mudar.error) : null}>
      <CampoCodigo
        label="Código"
        value={codigo}
        onChangeText={setCodigo}
        erro={tentou ? codeError(codigo) : null}
        digitos={8}
        maxLength={9}
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
      <ThemedText themeColor="textMuted" style={styles.nota}>
        Se não houver conta com este email, não chega código nenhum.
      </ThemedText>
    </AuthForm>
  );
}

const styles = StyleSheet.create({
  email: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: 800,
  },
  nota: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
