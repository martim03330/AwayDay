import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { AuthForm, CampoCodigo } from '@/features/auth/components/AuthForm';
import { authErrorMessage } from '@/features/auth/errors';
import { useResendSignUpCode, useVerifySignUpCode } from '@/features/auth/hooks/useAuthActions';
import { useCloseAccountFlow } from '@/features/auth/hooks/useCloseAccountFlow';
import { codeError } from '@/features/auth/validation';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { icons } from '@/ui/icon';
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
      hero={{ icon: icons.email, tag: '8 algarismos' }}
      title="Escreve o código"
      intro={
        <>
          {'Enviámos um código de 8 algarismos para '}
          <ThemedText themeColor="text" style={styles.email}>
            {email}
          </ThemedText>
          {'. Pode demorar um minuto a chegar: espreita também o spam.'}
        </>
      }
      error={erroPedido ? authErrorMessage(erroPedido) : null}
      notice={reenviar.isSuccess ? 'Enviámos outro código.' : null}>
      <CampoCodigo
        label="Código"
        value={codigo}
        onChangeText={setCodigo}
        erro={tentou ? codeError(codigo) : null}
        digitos={8}
        maxLength={9}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={submeter}
      />
      <Button
        label={aConfirmar ? 'A confirmar…' : 'Confirmar'}
        onPress={submeter}
        disabled={aConfirmar}
      />
      <View style={styles.rodape}>
        <LinkTexto
          label={reenviar.isPending ? 'A enviar…' : 'Não chegou? Reenviar código'}
          onPress={() => reenviar.mutate(email)}
          disabled={reenviar.isPending}
        />
        <ThemedText themeColor="textMuted" style={styles.nota}>
          Se já tinhas conta com este email, não chega código nenhum: entra com a tua password.
        </ThemedText>
      </View>
    </AuthForm>
  );
}

const styles = StyleSheet.create({
  email: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: 800,
  },
  rodape: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  nota: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
