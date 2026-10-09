import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { parseInviteCode } from '@/features/groups/invite-code';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { LinkTexto } from '@/ui/link-texto';

/**
 * «Tenho um código»: for when the invite link does not open the app (WhatsApp does not open app links). The code, or
 * the whole link pasted, goes to the same invite screen as the link, which shows the group before joining.
 */
export function EntrarComCodigo() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) {
    return <LinkTexto neutro label="Tenho um código" onPress={() => setAberto(true)} />;
  }

  function fechar() {
    setAberto(false);
    setTexto('');
    setErro(null);
  }

  function verConvite() {
    const code = parseInviteCode(texto);
    if (!code) {
      setErro('O código tem 10 letras e algarismos. Confirma o que a malta te mandou.');
      return;
    }
    fechar();
    router.push({ pathname: '/grupos/entrar', params: { code } });
  }

  return (
    <Card style={styles.cartao}>
      <Campo
        label="Código do convite"
        value={texto}
        onChangeText={(novo) => {
          setTexto(novo);
          setErro(null);
        }}
        erro={erro}
        ajuda="Cola o código ou o link inteiro que a malta te mandou."
        placeholder="ex.: 3f9a0c1b7e"
        autoCapitalize="none"
        autoFocus
        returnKeyType="go"
        onSubmitEditing={verConvite}
      />
      <Button label="Ver o convite" onPress={verConvite} disabled={!texto.trim()} />
      <LinkTexto neutro label="Cancelar" onPress={fechar} />
    </Card>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.two,
  },
});
