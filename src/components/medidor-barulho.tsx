import { Linking, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useBarulhometro } from '@/hooks/use-barulhometro';
import { mensagensMedicaoInvalida } from '@/lib/barulhometro';
import { Aviso } from '@/ui/aviso';
import { Button } from '@/ui/button';
import { icons } from '@/ui/icon';
import { ProgressBar } from '@/ui/progress-bar';
import { ThemedText } from '@/ui/themed-text';

type MedidorBarulhoProps = {
  onMedicaoValida: (nivel: number) => void;
};

/** Botão e progresso da medição. Só é montado quando a medição pode contar. */
export function MedidorBarulho({ onMedicaoValida }: MedidorBarulhoProps) {
  const { estado, medir, cancelar } = useBarulhometro(onMedicaoValida);
  const tentarOutraVez = (
    <Button label="Tentar outra vez" icon={icons.microfone} onPress={() => void medir()} />
  );

  switch (estado.tipo) {
    case 'parado':
      return (
        <View style={styles.bloco}>
          <Button label="Medir o barulho (10 s)" icon={icons.microfone} onPress={() => void medir()} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centro}>
            Telemóvel à altura do peito, virado para o relvado. Nada de o encostar à boca.
          </ThemedText>
        </View>
      );
    case 'a-medir':
      return (
        <View style={styles.bloco}>
          <View style={styles.linha} accessible accessibilityLiveRegion="polite">
            <ThemedText type="smallBold" style={styles.flex}>
              A ouvir a bancada…
            </ThemedText>
            <ThemedText type="smallBold" style={styles.numero}>
              {estado.nivelAtual}
            </ThemedText>
          </View>
          <ProgressBar progress={estado.progresso} accessibilityLabel="Progresso da medição" />
          <Button label="Cancelar" variant="secondary" icon={icons.fechar} onPress={cancelar} />
        </View>
      );
    case 'invalida': {
      const { titulo, mensagem } = mensagensMedicaoInvalida[estado.motivo];
      return (
        <View style={styles.bloco}>
          <Aviso title={titulo} message={mensagem} />
          {tentarOutraVez}
        </View>
      );
    }
    case 'sem-permissao':
      return (
        <View style={styles.bloco}>
          <ThemedText type="small">
            Sem acesso ao microfone não há barulhómetro. Não gravamos nada: só medimos o nível.
          </ThemedText>
          {estado.podePedirOutraVez ? (
            tentarOutraVez
          ) : (
            <Button
              label="Abrir definições"
              variant="secondary"
              onPress={() => void Linking.openSettings()}
            />
          )}
        </View>
      );
    case 'erro':
      return (
        <View style={styles.bloco}>
          <Aviso
            title="O microfone não arrancou"
            message="Pode estar ocupado por outra app. Tenta outra vez."
          />
          {tentarOutraVez}
        </View>
      );
  }
}

const styles = StyleSheet.create({
  bloco: {
    gap: Spacing.two,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  numero: {
    fontVariant: ['tabular-nums'],
  },
  centro: {
    textAlign: 'center',
  },
});
