import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { plural } from '@/lib/formatos';
import type { Local } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

/** "Tem WC para clientes", "Não tem WC" or "Ainda sem respostas", from what fans answered. Ties stay undecided. */
export function resumoWcDoTasco({ sim, nao }: Local['wcNoTasco']) {
  if (sim === 0 && nao === 0) return { texto: 'Ainda sem respostas', tom: 'neutro' as const };
  if (sim > nao) return { texto: 'Tem WC para clientes', tom: 'positivo' as const };
  if (nao > sim) return { texto: 'Não tem WC', tom: 'aviso' as const };
  return { texto: 'Respostas divididas', tom: 'neutro' as const };
}

/**
 * Whether the tasco itself has a toilet for customers. OpenStreetMap almost never records it, so fans answer and
 * everyone sees how many said what.
 */
export function WcDoTasco({ local }: { local: Local }) {
  const router = useRouter();
  const { fonte, wcTascos, responderWcTasco } = useAppState();
  const resposta = wcTascos[local.id];
  const { sim, nao } = local.wcNoTasco;
  const resumo = resumoWcDoTasco(local.wcNoTasco);

  return (
    <Card style={styles.card}>
      <View style={styles.topo}>
        <ThemedText style={styles.pergunta}>Tem WC para clientes?</ThemedText>
        <Etiqueta icon={icons.wc} label={resumo.texto} tone={resumo.tom} />
      </View>
      {sim + nao > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {`${plural(sim, 'adepto diz', 'adeptos dizem')} que sim · ${nao} que não.`}
        </ThemedText>
      ) : null}

      {fonte === 'telemovel' ? (
        <View style={styles.semConta}>
          <ThemedText type="small" themeColor="textSecondary">
            Entra na tua conta para responder e ajudar quem vem a seguir.
          </ThemedText>
          <LinkTexto label="Entrar" onPress={() => router.push('/conta/entrar')} />
        </View>
      ) : (
        <View style={styles.botoes}>
          <View style={styles.botao}>
            <Button
              label="Tem"
              icon={icons.checkInFeito}
              variant={resposta === true ? 'primary' : 'secondary'}
              onPress={() => responderWcTasco(local.id, true)}
            />
          </View>
          <View style={styles.botao}>
            <Button
              label="Não tem"
              icon={icons.fechar}
              variant={resposta === false ? 'danger' : 'secondary'}
              onPress={() => responderWcTasco(local.id, false)}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  topo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  pergunta: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 800,
  },
  semConta: {
    gap: Spacing.one,
  },
  botoes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  botao: {
    flex: 1,
  },
});
