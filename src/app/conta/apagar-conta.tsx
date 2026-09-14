import { useState } from 'react';
import { Alert } from 'react-native';

import { AuthForm } from '@/features/auth/components/AuthForm';
import { authErrorCode, authErrorMessage } from '@/features/auth/errors';
import { useDeleteAccount } from '@/features/auth/hooks/useAuthActions';
import { useCloseAccountFlow } from '@/features/auth/hooks/useCloseAccountFlow';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { icons } from '@/ui/icon';

export default function ApagarContaScreen() {
  const apagar = useDeleteAccount();
  const { onboardingConcluido } = useAppState();
  const fecharConta = useCloseAccountFlow(onboardingConcluido);
  const [password, setPassword] = useState('');
  const [tentou, setTentou] = useState(false);
  const aApagar = apagar.isPending || apagar.isSuccess;

  const erroPedido = !apagar.error
    ? null
    : authErrorCode(apagar.error) === 'invalid_credentials'
      ? 'A password não está certa.'
      : authErrorMessage(apagar.error);

  function submeter() {
    setTentou(true);
    if (!password || aApagar) return;
    apagar.mutate(
      { password },
      {
        onSuccess: () => {
          fecharConta();
          Alert.alert('Conta apagada', 'Até à próxima. A app continua a funcionar sem conta.');
        },
      }
    );
  }

  return (
    <AuthForm
      intro="Apagamos a conta, o nome, os clubes e o histórico guardados. Não dá para desfazer. Para confirmar, escreve a tua password."
      error={erroPedido}>
      <Campo
        label="Password"
        value={password}
        onChangeText={setPassword}
        erro={tentou && !password ? 'Falta a password.' : null}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        autoFocus
        returnKeyType="go"
        onSubmitEditing={submeter}
      />
      <Button
        label={aApagar ? 'A apagar a conta…' : 'Apagar conta'}
        variant="danger"
        icon={icons.apagar}
        onPress={submeter}
        disabled={aApagar}
      />
    </AuthForm>
  );
}
