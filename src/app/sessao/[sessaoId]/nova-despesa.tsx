import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type TextInput,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import {
  addTripExpense,
  CATEGORIAS,
  novoIdDePedido,
  type CategoriaDespesa,
  type NovaDespesa,
} from '@/features/trips/api';
import { CATEGORIA } from '@/features/trips/categorias';
import { useRefreshTrips, useTripPeople } from '@/features/trips/hooks/useTrips';
import { mensagemDeRecusaDasContas } from '@/features/trips/recusas';
import { useTheme } from '@/hooks/use-theme';
import { lerPrecoEmCentimos, parteDeCadaCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Chip } from '@/ui/chip';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';
import { MensagemErro } from '@/ui/mensagem-erro';
import { useFormatarDinheiro } from '@/ui/valor';

/**
 * Add an expense: what it was, how much, its type, who paid and who is in. By default you paid and everyone is in —
 * the round of drinks. The final split is always the server's; here it is only previewed before adding.
 */
export default function NovaDespesaScreen() {
  const dinheiro = useFormatarDinheiro();
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const refrescar = useRefreshTrips();
  const { sessaoId } = useLocalSearchParams<{ sessaoId?: string }>();
  const pessoas = useTripPeople(sessaoId ?? null);

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const campoValor = useRef<TextInput>(null);
  const [tipo, setTipo] = useState<CategoriaDespesa>('cerveja');
  const [quemPagou, setQuemPagou] = useState<string | null>(null);
  // `null` até alguém mexer: até lá, entra a malta toda.
  const [quemEntra, setQuemEntra] = useState<string[] | null>(null);
  const [aLancar, setALancar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // The request id of what was last sent. Tapping again with the same form (after a timeout, say) reuses it, so the
  // server writes the expense once; changing anything in the form makes it a new request.
  const pedido = useRef<{ chave: string; id: string | undefined } | null>(null);

  const gente = pessoas.data ?? [];
  const escolhidos = quemEntra ?? gente.map((pessoa) => pessoa.profileId);
  const centimos = lerPrecoEmCentimos(valor);
  // The same «cada» as everywhere else: the share nobody pays more than (who pays the odd cent is the server's call).
  const cada =
    centimos !== null && centimos > 0 && escolhidos.length > 0
      ? parteDeCadaCentimos(centimos, new Set(escolhidos).size)
      : null;
  const podeLancar =
    !aLancar &&
    sessaoId !== undefined &&
    descricao.trim().length >= 2 &&
    centimos !== null &&
    centimos > 0 &&
    escolhidos.length > 0;

  async function lancar() {
    if (!sessaoId || centimos === null) return;
    setErro(null);
    setALancar(true);
    const despesa: NovaDespesa = {
      sessionId: sessaoId,
      description: descricao,
      category: tipo,
      cents: centimos,
      payerId: quemPagou ?? undefined,
      participants: quemEntra ?? undefined,
    };
    const chave = JSON.stringify(despesa);
    if (pedido.current?.chave !== chave) pedido.current = { chave, id: novoIdDePedido() };
    try {
      await addTripExpense({ ...despesa, clientId: pedido.current.id });
      await refrescar();
      router.back();
    } catch (problema) {
      setErro(mensagemDeRecusaDasContas(problema));
      setALancar(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.tudo}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle" accessibilityRole="header">
          Nova despesa
        </ThemedText>

        <Campo
          label="O que foi"
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Rodada no café da esquina"
          maxLength={80}
          autoCapitalize="sentences"
          returnKeyType="next"
          onSubmitEditing={() => campoValor.current?.focus()}
        />
        <Campo
          ref={campoValor}
          label="Quanto custou"
          value={valor}
          onChangeText={setValor}
          placeholder="12,50"
          keyboardType="decimal-pad"
          returnKeyType="done"
          erro={valor.length > 0 && centimos === null ? 'Escreve um valor como 12,50.' : null}
        />

        <View style={styles.bloco}>
          <ThemedText type="smallBold">Tipo</ThemedText>
          <View style={styles.chips}>
            {CATEGORIAS.map((nome) => (
              <Chip
                key={nome}
                label={CATEGORIA[nome].nome}
                selected={tipo === nome}
                onPress={() => setTipo(nome)}
              />
            ))}
          </View>
        </View>

        <View style={styles.bloco}>
          <ThemedText type="smallBold">Quem pagou</ThemedText>
          <View style={styles.chips}>
            {gente.map((pessoa) => (
              <Chip
                key={pessoa.profileId}
                label={pessoa.isMe ? 'Eu' : pessoa.displayName}
                selected={(quemPagou ?? userId) === pessoa.profileId}
                onPress={() => setQuemPagou(pessoa.profileId)}
              />
            ))}
          </View>
        </View>

        <View style={styles.bloco}>
          <ThemedText type="smallBold">Quem entra</ThemedText>
          <View style={styles.chips}>
            {gente.map((pessoa) => (
              <Chip
                key={pessoa.profileId}
                label={pessoa.isMe ? 'Eu' : pessoa.displayName}
                selected={escolhidos.includes(pessoa.profileId)}
                accessibilityLabel={`${pessoa.displayName} entra nesta despesa`}
                onPress={() =>
                  setQuemEntra(
                    escolhidos.includes(pessoa.profileId)
                      ? escolhidos.filter((id) => id !== pessoa.profileId)
                      : [...escolhidos, pessoa.profileId]
                  )
                }
              />
            ))}
          </View>
          {escolhidos.length === 0 ? (
            <ThemedText type="small" themeColor="textMuted">
              Escolhe pelo menos uma pessoa.
            </ThemedText>
          ) : cada !== null ? (
            <ThemedText type="small" themeColor="textSecondary">
              {`${dinheiro.formatar(cada)} para cada um`}
            </ThemedText>
          ) : null}
        </View>

        {erro ? <MensagemErro>{erro}</MensagemErro> : null}

        <Button
          label={aLancar ? 'A lançar…' : 'Lançar despesa'}
          icon={icons.preco}
          disabled={!podeLancar}
          onPress={() => void lancar()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tudo: {
    flex: 1,
  },
  conteudo: {
    gap: Spacing.three,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  bloco: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
