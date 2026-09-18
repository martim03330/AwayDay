import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { createGroup, GroupRefused } from '@/features/groups/api';
import { useRefreshGroups } from '@/features/groups/hooks/useGroups';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof GroupRefused)) return 'Não deu para criar o grupo. Tenta outra vez.';
  switch (erro.reason) {
    case 'bad_name':
      return 'O nome do grupo tem de ter entre 2 e 60 letras.';
    case 'rate_limited':
      return 'Já criaste grupos que cheguem por hoje.';
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
    try {
      const grupoId = await createGroup(limpo);
      await refrescar();
      router.back();
      router.push({ pathname: '/grupos/[grupoId]', params: { grupoId } });
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
      setACriar(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.conteudo}
      keyboardShouldPersistTaps="handled">
      <ThemedText type="title">Novo grupo</ThemedText>
      <ThemedText themeColor="textSecondary">
        A malta do café, os do autocarro da claque, os primos que vão sempre. Dá-lhe um nome — o
        resto trata-se lá dentro.
      </ThemedText>
      <Campo
        label="Nome do grupo"
        value={nome}
        onChangeText={setNome}
        placeholder="Ex.: A malta do café"
        maxLength={60}
        autoFocus
      />
      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}
      <Button
        label={aCriar ? 'A criar…' : 'Criar grupo'}
        icon={icons.perfil}
        disabled={aCriar}
        onPress={() => void criar()}
      />
      <ThemedText type="small" themeColor="textMuted">
        Depois de criado, partilhas um link e quem o abrir entra no grupo.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Spacing.three,
    padding: Spacing.four,
  },
});
