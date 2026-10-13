import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import {
  comecarSegundoFator,
  confirmarCodigo,
  estadoDoSegundoFator,
  lerCodigo,
  type NovoSegundoFator,
} from '@/features/profile/segundo-fator';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/session';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { IconCircle, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * The admin tools, behind the second factor. Until this session is verified with a code from an authenticator app,
 * the server treats the admin as an ordinary account, so the tools would only show empty lists: this asks for the
 * code first (or, the first time, sets the app up).
 */
export function SegundoFatorAdmin({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const chave = ['segundo-fator', userId] as const;
  const estado = useQuery({
    queryKey: chave,
    queryFn: userId ? estadoDoSegundoFator : skipToken,
    meta: { persist: false },
  });
  const [novo, setNovo] = useState<NovoSegundoFator | null>(null);
  const [codigo, setCodigo] = useState('');
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!estado.data) {
    return estado.isError ? (
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Não deu para ver a verificação em dois passos. Puxa para baixo para tentar outra vez.
        </ThemedText>
      </Card>
    ) : null;
  }
  if (estado.data.fase === 'confirmado') return <>{children}</>;

  const factorId = novo?.factorId ?? (estado.data.fase === 'por-confirmar' ? estado.data.factorId : null);

  async function ativar() {
    setErro(null);
    setATratar(true);
    try {
      setNovo(await comecarSegundoFator());
    } catch {
      setErro('Não deu para começar. Tenta outra vez.');
    } finally {
      setATratar(false);
    }
  }

  async function confirmar() {
    const lido = lerCodigo(codigo);
    if (!factorId || !lido) {
      setErro('Escreve os 6 números que a app de autenticação mostra agora.');
      return;
    }
    setErro(null);
    setATratar(true);
    try {
      await confirmarCodigo(factorId, lido);
      setCodigo('');
      setNovo(null);
      await queryClient.invalidateQueries({ queryKey: chave });
    } catch {
      setErro('Esse código não serviu. Os códigos mudam a cada 30 segundos: escreve o que aparece agora.');
    } finally {
      setATratar(false);
    }
  }

  const porAtivar = estado.data.fase === 'por-ativar';

  return (
    <Card style={styles.cartao}>
      <View style={styles.topo}>
        <IconCircle name={icons.password} tone="yellow" />
        <View style={styles.flex}>
          <ThemedText style={styles.titulo}>
            {porAtivar ? 'Ativa a verificação em dois passos' : 'Confirma que és tu'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {porAtivar
              ? 'As ferramentas de administração pedem um código de uma app de autenticação. Assim, uma palavra-passe roubada não chega.'
              : 'Escreve o código da tua app de autenticação para abrir as ferramentas de administração.'}
          </ThemedText>
        </View>
      </View>

      {porAtivar && !novo ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Serve qualquer app de autenticação gratuita: Google Authenticator, Microsoft Authenticator ou as
            Palavras-passe do iPhone.
          </ThemedText>
          <Button label={aTratar ? 'A preparar…' : 'Ativar'} disabled={aTratar} onPress={() => void ativar()} />
        </>
      ) : (
        <>
          {novo ? (
            <View style={styles.passos}>
              <ThemedText type="small">1. Junta o AwayDay à tua app de autenticação:</ThemedText>
              <LinkTexto
                label="Abrir na app de autenticação"
                onPress={() => void Linking.openURL(novo.uri).catch(() => undefined)}
              />
              <ThemedText type="small" themeColor="textSecondary">
                Ou escreve esta chave na app (toca e mantém para copiar):
              </ThemedText>
              <ThemedText selectable style={[styles.segredo, { backgroundColor: theme.backgroundSelected }]}>
                {novo.segredo}
              </ThemedText>
              <ThemedText type="small">2. Escreve o código de 6 números que a app mostra:</ThemedText>
            </View>
          ) : null}
          <Campo
            label="Código"
            value={codigo}
            onChangeText={setCodigo}
            placeholder="123 456"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={7}
            returnKeyType="done"
            onSubmitEditing={() => void confirmar()}
          />
          <Button label={aTratar ? 'A confirmar…' : 'Confirmar'} disabled={aTratar} onPress={() => void confirmar()} />
        </>
      )}

      {erro ? <ThemedText type="small" style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.twoAndHalf,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  titulo: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 800,
  },
  passos: {
    gap: Spacing.two,
  },
  segredo: {
    fontFamily: 'Menlo',
    fontSize: 15,
    letterSpacing: 1,
    padding: Spacing.two,
    borderRadius: 8,
    textAlign: 'center',
  },
});
