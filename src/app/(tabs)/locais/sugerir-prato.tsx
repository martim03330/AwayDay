import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { suggestDish, SuggestionRefused } from '@/features/places/api';
import { lerPrecoEmCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { obterLocal } from '@/mocks/locais';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { ThemedText } from '@/ui/themed-text';

type Temperatura = 'hot' | 'cold' | null;

/** A fan suggests a dish for a tasco. It only shows up on the menu after it is approved. */
export default function SugerirPratoScreen() {
  const router = useRouter();
  const userId = useUserId();
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const local = localId ? obterLocal(localId) : undefined;

  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [minutos, setMinutos] = useState('');
  const [temperatura, setTemperatura] = useState<Temperatura>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [tentouEnviar, setTentouEnviar] = useState(false);

  if (!local) {
    return (
      <Screen>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Tasco não encontrado"
          message="Volta à ficha do tasco e tenta outra vez."
          action={{ label: 'Voltar', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Precisas de conta"
          message="As sugestões ficam associadas à tua conta, para evitar spam."
          action={{ label: 'Entrar', onPress: () => router.push('/conta/entrar') }}
        />
      </Screen>
    );
  }

  const nomeLimpo = nome.trim();
  const erroNome = nomeLimpo.length < 2 ? 'Escreve o nome do prato.' : null;
  const precoCentimos = preco.trim() === '' ? null : lerPrecoEmCentimos(preco);
  const erroPreco =
    preco.trim() !== '' && precoCentimos === null ? 'Escreve o preço assim: 3,50' : null;
  const minutosNumero = minutos.trim() === '' ? null : Number(minutos.trim());
  const erroMinutos =
    minutosNumero !== null &&
    !(Number.isInteger(minutosNumero) && minutosNumero >= 0 && minutosNumero <= 120)
      ? 'Entre 0 e 120 minutos.'
      : null;
  const valido = !erroNome && !erroPreco && !erroMinutos;

  async function enviar() {
    setTentouEnviar(true);
    if (!valido || !local || aEnviar) return;
    setAEnviar(true);
    try {
      await suggestDish({
        placeId: local.id,
        name: nomeLimpo,
        priceCents: precoCentimos,
        prepMinutes: minutosNumero,
        temperature: temperatura,
      });
      Alert.alert('Obrigado!', 'O prato aparece no menu depois de ser confirmado.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (erro: unknown) {
      if (erro instanceof SuggestionRefused) {
        Alert.alert(
          erro.reason === 'duplicate' ? 'Esse prato já foi sugerido' : 'Por hoje chega',
          erro.reason === 'duplicate'
            ? 'Alguém já sugeriu este prato para este tasco.'
            : 'Já enviaste muitas sugestões hoje. Volta amanhã.'
        );
      } else {
        Alert.alert('Não deu para enviar', 'Verifica a ligação e tenta outra vez.');
      }
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <Screen>
      <View style={styles.cabecalho}>
        <ThemedText type="eyebrow" themeColor="accentInk">
          {local.nome}
        </ThemedText>
        <ThemedText type="section">Sugerir um prato</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.texto}>
          Só o que já provaste. A sugestão aparece no menu depois de ser confirmada.
        </ThemedText>
      </View>

      <Campo
        label="Prato"
        value={nome}
        onChangeText={setNome}
        placeholder="Bifana no pão"
        maxLength={60}
        autoCapitalize="sentences"
        erro={tentouEnviar ? erroNome : null}
      />
      <Campo
        label="Preço"
        value={preco}
        onChangeText={setPreco}
        placeholder="3,50"
        keyboardType="decimal-pad"
        maxLength={8}
        ajuda="Deixa em branco se não souberes."
        erro={erroPreco}
      />
      <Campo
        label="Minutos até sair"
        value={minutos}
        onChangeText={setMinutos}
        placeholder="5"
        keyboardType="number-pad"
        maxLength={3}
        ajuda="Opcional. Ajuda quem tem o jogo já a seguir."
        erro={erroMinutos}
      />

      <View style={styles.temperatura}>
        <ThemedText style={styles.rotulo}>Quente ou fria?</ThemedText>
        <View style={styles.chips}>
          <Chip
            label="Quente"
            selected={temperatura === 'hot'}
            onPress={() => setTemperatura('hot')}
          />
          <Chip
            label="Fria"
            selected={temperatura === 'cold'}
            onPress={() => setTemperatura('cold')}
          />
          <Chip
            label="Não sei"
            selected={temperatura === null}
            onPress={() => setTemperatura(null)}
          />
        </View>
      </View>

      <Button
        label={aEnviar ? 'A enviar…' : 'Enviar sugestão'}
        onPress={() => void enviar()}
        disabled={aEnviar}
      />
      <LinkTexto label="Cancelar" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    gap: 4,
  },
  texto: {
    fontSize: 14,
    lineHeight: 20,
  },
  temperatura: {
    gap: 8,
  },
  rotulo: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 800,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
