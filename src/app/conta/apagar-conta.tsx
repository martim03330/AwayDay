import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from 'react-native';

import { apagarContaJaConfirmada, comoEntraEstaConta } from '@/features/auth/api';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { authErrorCode, authErrorMessage } from '@/features/auth/errors';
import { useDeleteAccount } from '@/features/auth/hooks/useAuthActions';
import { useCloseAccountFlow } from '@/features/auth/hooks/useCloseAccountFlow';
import { useSocialSignIn, type SocialProvider } from '@/features/auth/hooks/useSocialSignIn';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { icons } from '@/ui/icon';
import { MensagemErro } from '@/ui/mensagem-erro';
import { SkeletonCard } from '@/ui/skeleton';

const NOMES: Record<SocialProvider, string> = { apple: 'Apple', google: 'Google' };

/**
 * Deleting the account. With a palavra-passe, it is asked again; an account made with Apple or Google has none, so
 * the person confirms with Apple or Google instead (the App Store requires that such accounts can be deleted).
 */
export default function ApagarContaScreen() {
  const conta = useQuery({ queryKey: ['conta', 'como-entra'], queryFn: comoEntraEstaConta, meta: { persist: false } });
  const fornecedores = conta.data?.fornecedores ?? [];
  const soSocial: SocialProvider | null = fornecedores.includes('email')
    ? null
    : fornecedores.includes('apple')
      ? 'apple'
      : fornecedores.includes('google')
        ? 'google'
        : null;

  if (conta.isLoading) return <SkeletonCard lines={3} />;
  return soSocial && conta.data ? (
    <ApagarComFornecedor fornecedor={soSocial} contaId={conta.data.id} />
  ) : (
    <ApagarComPalavraPasse />
  );
}

function ApagarComFornecedor({ fornecedor, contaId }: { fornecedor: SocialProvider; contaId: string }) {
  const social = useSocialSignIn();
  const fecharConta = useCloseAccountFlow();
  const [aApagar, setAApagar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmarEApagar() {
    if (aApagar) return;
    setErro(null);
    setAApagar(true);
    try {
      const resultado = await social.mutateAsync(fornecedor);
      if (resultado === 'cancelled') return;
      // Only the account that was signed in: another Apple or Google account chosen by mistake is never deleted.
      const agora = await comoEntraEstaConta();
      if (agora?.id !== contaId) {
        setErro(`Essa não é a conta com que entraste. Confirma com a mesma conta ${NOMES[fornecedor]}.`);
        return;
      }
      await apagarContaJaConfirmada();
      fecharConta();
      Alert.alert('Conta apagada', 'Até à próxima.');
    } catch (problema) {
      setErro(authErrorMessage(problema));
    } finally {
      setAApagar(false);
    }
  }

  return (
    <AuthForm
      intro={`Apagamos a conta, o nome, os clubes e o histórico guardados. Não dá para desfazer. Para confirmar que és tu, entra outra vez com ${NOMES[fornecedor]}.`}
      error={null}>
      {erro ? <MensagemErro>{erro}</MensagemErro> : null}
      <Button
        label={aApagar ? 'A apagar a conta…' : `Confirmar com ${NOMES[fornecedor]} e apagar`}
        variant="danger"
        icon={icons.apagar}
        onPress={() => void confirmarEApagar()}
        disabled={aApagar}
      />
    </AuthForm>
  );
}

function ApagarComPalavraPasse() {
  const apagar = useDeleteAccount();
  const fecharConta = useCloseAccountFlow();
  const [password, setPassword] = useState('');
  const [tentou, setTentou] = useState(false);
  const aApagar = apagar.isPending || apagar.isSuccess;

  const erroPedido = !apagar.error
    ? null
    : authErrorCode(apagar.error) === 'invalid_credentials'
      ? 'A palavra-passe não está certa.'
      : authErrorMessage(apagar.error);

  function submeter() {
    setTentou(true);
    if (!password || aApagar) return;
    apagar.mutate(
      { password },
      {
        onSuccess: () => {
          fecharConta();
          Alert.alert('Conta apagada', 'Até à próxima.');
        },
      }
    );
  }

  return (
    <AuthForm
      intro="Apagamos a conta, o nome, os clubes e o histórico guardados. Não dá para desfazer. Para confirmar, escreve a tua palavra-passe."
      error={erroPedido}>
      <Campo
        label="Palavra-passe"
        value={password}
        onChangeText={setPassword}
        erro={tentou && !password ? 'Falta a palavra-passe.' : null}
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
