import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { reportErrorOnce } from '@/features/feedback/report';
import { createGroup, GroupRefused } from '@/features/groups/api';
import { useRefreshGroups } from '@/features/groups/hooks/useGroups';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';
import { MensagemErro } from '@/ui/mensagem-erro';

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof GroupRefused)) return 'Não deu para criar o grupo. Tenta outra vez.';
  switch (erro.reason) {
    case 'bad_name':
      return 'Escolhe outro nome (entre 2 e 60 letras, sem palavrões).';
    case 'rate_limited':
      return 'Já criaste grupos que cheguem por hoje.';
    case 'not_signed_in':
      return 'A tua sessão terminou. Entra outra vez para criar o grupo.';
    default:
      return 'Não deu para criar o grupo. Tenta outra vez.';
  }
}

/** Criar um grupo: só um nome. A foto, o fundo e o convite vêm depois, lá dentro. */
export default function NovoGrupoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const refrescar = useRefreshGroups();

  const [nome, setNome] = useState('');
  const [aCriar, setACriar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    const limpo = nome.trim();
    if (limpo.length < 2) {
      setErro('Escreve um nome para o grupo.');
      return;
    }
    setErro(null);
    setACriar(true);
    let grupoId: string;
    try {
      grupoId = await createGroup(limpo);
    } catch (problema) {
      if (!(problema instanceof GroupRefused) || problema.reason === 'unknown') {
        const detalhe = problema instanceof GroupRefused ? problema.detail : problema;
        void reportErrorOnce('criar-grupo', 'Criar grupo', detalhe, { area: 'grupos' });
      }
      setErro(mensagemDeRecusa(problema));
      setACriar(false);
      return;
    }
    // The group exists from here on: nothing below may show "could not create it" (a retry would make a second one).
    void refrescar();
    router.back();
    router.push({ pathname: '/grupos/[grupoId]', params: { grupoId } });
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.conteudo}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <ThemedText type="title" accessibilityRole="header">
        Novo grupo
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        Dá-lhe um nome. Depois partilhas o link e quem o abrir entra.
      </ThemedText>
      <Campo
        label="Nome do grupo"
        value={nome}
        onChangeText={setNome}
        placeholder="Ex.: A malta do café"
        maxLength={60}
        autoFocus
        autoCapitalize="sentences"
        returnKeyType="done"
      />
      {erro ? <MensagemErro>{erro}</MensagemErro> : null}
      <Button
        label={aCriar ? 'A criar…' : 'Criar grupo'}
        icon={icons.perfil}
        disabled={aCriar}
        onPress={() => void criar()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Spacing.three,
    padding: Spacing.four,
  },
});
