import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import type { Local } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { IconCircle, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

/** Warning and "is this a good place for match day?" for places found automatically near the stadium. */
export function TascoPorConfirmar({ local }: { local: Local }) {
  const router = useRouter();
  const theme = useTheme();
  const { fonte, votosTascos, votarTasco } = useAppState();
  const voto = votosTascos[local.id];

  return (
    <View style={[styles.cartao, { backgroundColor: theme.warningBackground }]}>
      <View style={styles.topo}>
        <IconCircle name={icons.porVerificar} tone="yellow" />
        <View style={styles.textos}>
          <ThemedText style={[styles.titulo, { color: theme.warningText }]}>
            Sugestão por confirmar
          </ThemedText>
          <ThemedText style={[styles.texto, { color: theme.warningText }]}>
            Encontrámos este sítio perto do estádio, mas ainda não sabemos se é um bom tasco para
            dia de jogo.
          </ThemedText>
        </View>
      </View>

      <ThemedText style={styles.pergunta}>É um bom sítio para ir antes do jogo?</ThemedText>

      {fonte === 'telemovel' ? (
        <View style={styles.semConta}>
          <ThemedText themeColor="textSecondary" style={styles.texto}>
            Entra na tua conta para responder. Com respostas suficientes, o tasco fica confirmado.
          </ThemedText>
          <LinkTexto label="Entrar" onPress={() => router.push('/conta/entrar')} />
        </View>
      ) : (
        <>
          <View style={styles.botoes}>
            <View style={styles.botao}>
              <Button
                label="Sim"
                icon={icons.checkInFeito}
                variant={voto === true ? 'primary' : 'secondary'}
                selected={voto === true}
                onPress={() => votarTasco(local.id, true)}
              />
            </View>
            <View style={styles.botao}>
              <Button
                label="Não"
                icon={icons.fechar}
                variant={voto === false ? 'danger' : 'secondary'}
                selected={voto === false}
                onPress={() => votarTasco(local.id, false)}
              />
            </View>
          </View>
          <ThemedText themeColor="textSecondary" style={styles.rodape}>
            {voto === undefined
              ? local.votos.sim > 0
                ? `${plural(local.votos.sim, 'adepto já disse', 'adeptos já disseram')} que sim.`
                : 'Sê o primeiro a responder.'
              : 'Obrigado! Podes mudar a resposta quando quiseres.'}
          </ThemedText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: 12,
    padding: 14,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 800,
  },
  texto: {
    fontSize: 13,
    lineHeight: 19,
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
  rodape: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
