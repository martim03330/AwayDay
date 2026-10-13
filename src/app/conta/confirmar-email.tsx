import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { AuthForm, CampoCodigo } from '@/features/auth/components/AuthForm';
import { authErrorMessage } from '@/features/auth/errors';
import { useResendSignUpCode, useVerifySignUpCode } from '@/features/auth/hooks/useAuthActions';
import { useCloseAccountFlow } from '@/features/auth/hooks/useCloseAccountFlow';
import { codeError } from '@/features/auth/validation';
import { Button } from '@/ui/button';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

/** Same as the project's minimum time between emails (Supabase Auth, `smtp_max_frequency`). */
const ESPERA_ENTRE_CODIGOS_MS = 60 * 1000;

export default function ConfirmarEmailScreen() {
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const verificar = useVerifySignUpCode();
  const reenviar = useResendSignUpCode();
  const fecharConta = useCloseAccountFlow();
  const [codigo, setCodigo] = useState('');
  const [tentou, setTentou] = useState(false);
  // Supabase sends at most one code a minute per email: the button says how long is left instead of failing.
  const [podeReenviarEm, setPodeReenviarEm] = useState(() => Date.now() + ESPERA_ENTRE_CODIGOS_MS);
  const [agora, setAgora] = useState(() => Date.now());
  const faltam = Math.max(0, Math.ceil((podeReenviarEm - agora) / 1000));

  useEffect(() => {
    if (faltam === 0) return;
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(relogio);
  }, [faltam]);

  function pedirOutro() {
    if (faltam > 0 || reenviar.isPending) return;
    reenviar.mutate(email, {
      onSettled: () => {
        setPodeReenviarEm(Date.now() + ESPERA_ENTRE_CODIGOS_MS);
        setAgora(Date.now());
      },
    });
  }

  const erroPedido = verificar.error ?? reenviar.error;
  const aConfirmar = verificar.isPending || verificar.isSuccess;

  // A wrong code is cleared, so the right one can be typed at once (the keyboard stays open).
  function submeter(code = codigo) {
    setTentou(true);
    if (codeError(code) || aConfirmar) return;
    verificar.mutate(
      { email, code },
      {
        onSuccess: fecharConta,
        onError: () => {
          setCodigo('');
          setTentou(false);
        },
      }
    );
  }

  function escrever(texto: string) {
    // Typing again takes the previous error away.
    if (verificar.isError) verificar.reset();
    setCodigo(texto);
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
        onChangeText={escrever}
        erro={tentou ? codeError(codigo) : null}
        digitos={8}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={() => submeter()}
        onCompleto={submeter}
      />
      {/* Right under the code, where the keyboard never hides it. */}
      <LinkTexto
        label={
          reenviar.isPending
            ? 'A enviar…'
            : faltam > 0
              ? `Não chegou? Reenviar código em ${faltam} s`
              : 'Não chegou? Reenviar código'
        }
        onPress={pedirOutro}
        disabled={reenviar.isPending || faltam > 0}
      />
      <Button
        label={aConfirmar ? 'A confirmar…' : 'Confirmar'}
        onPress={() => submeter()}
        disabled={aConfirmar}
      />
      <View style={styles.rodape}>
        <ThemedText themeColor="textMuted" style={styles.nota}>
          Se já tinhas conta com este email, não chega código nenhum: entra com a tua palavra-passe.
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
