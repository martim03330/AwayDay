import { Linking, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { useBarulhometro } from '@/hooks/use-barulhometro';
import { useTheme } from '@/hooks/use-theme';
import {
  degrauDoNivel,
  DURACAO_MEDICAO_MS,
  ESCALA_BARULHO,
  mensagensMedicaoInvalida,
} from '@/lib/barulhometro';
import { Aviso } from '@/ui/aviso';
import { Button } from '@/ui/button';
import { icons } from '@/ui/icon';
import { ProgressBar } from '@/ui/progress-bar';
import { ThemedText } from '@/ui/themed-text';

/** Gauge arc colours, one per step of the scale (quiet to loudest). Not theme tokens: gauge-only. */
export const CORES_ESCALA = ['#BFD9C7', '#7CC08F', '#FFCE3A', '#F28C28', '#D9432F'] as const;
/** Readable ink for text and icons on white, per step (the two lighter arc colours are too pale). */
const TINTAS_ESCALA = ['#56675D', '#16713F', '#B07A00', '#F28C28', '#D9432F'] as const;

function indiceDoNivel(nivel: number) {
  return Math.max(0, ESCALA_BARULHO.indexOf(degrauDoNivel(nivel)));
}

export function corDoNivel(nivel: number) {
  return CORES_ESCALA[indiceDoNivel(nivel)] ?? CORES_ESCALA[0];
}

export function tintaDoNivel(nivel: number) {
  return TINTAS_ESCALA[indiceDoNivel(nivel)] ?? TINTAS_ESCALA[0];
}

// Gauge geometry in a 320x184 viewBox: centre (160, 160), radius 130, needle 105.
const CX = 160;
const CY = 160;
const RAIO = 130;
const AGULHA = 105;

/** Point on the half circle for a level from 0 (left) to 100 (right). */
function ponto(nivel: number, raio: number) {
  const angulo = (Math.min(100, Math.max(0, nivel)) / 100) * Math.PI;
  const x = CX - raio * Math.cos(angulo);
  const y = CY - raio * Math.sin(angulo);
  return `${x.toFixed(1)} ${y.toFixed(1)}`;
}

/** Semicircular gauge for a 0-100 level. Decorative: the number and level name are shown beside it. */
export function MostradorBarulho({ nivel, largura = 300 }: { nivel: number; largura?: number }) {
  const theme = useTheme();
  const segments = ESCALA_BARULHO.map((degrau, indice) => ({
    inicio: degrau.minimo,
    fim: ESCALA_BARULHO[indice + 1]?.minimo ?? 100,
    cor: CORES_ESCALA[indice] ?? CORES_ESCALA[0],
  }));

  return (
    <View
      style={[styles.mostrador, { maxWidth: largura }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 320 184" fill="none">
        {segments.map((segment) => (
          <Path
            key={segment.inicio}
            d={`M${ponto(segment.inicio, RAIO)} A${RAIO} ${RAIO} 0 0 1 ${ponto(segment.fim, RAIO)}`}
            stroke={segment.cor}
            strokeWidth={26}
          />
        ))}
        <Path
          d={`M${CX} ${CY} L${ponto(nivel, AGULHA)}`}
          stroke={theme.text}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <Circle cx={CX} cy={CY} r={12} fill={theme.text} />
        <Circle cx={CX} cy={CY} r={5} fill={theme.highlight} />
      </Svg>
    </View>
  );
}

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
    case 'a-medir': {
      const segundos = Math.max(0, Math.ceil(((1 - estado.progresso) * DURACAO_MEDICAO_MS) / 1000));
      return (
        <View style={styles.bloco}>
          <View style={styles.escuta}>
            <ThemedText
              style={styles.tituloEscuta}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              A ouvir a bancada…
            </ThemedText>
            <View style={styles.linha}>
              <View
                style={styles.valorAoVivo}
                accessible
                accessibilityLiveRegion="polite"
                accessibilityLabel={`A ouvir a bancada… ${estado.nivelAtual}`}>
                <ThemedText
                  type="score"
                  style={[styles.numero, { color: tintaDoNivel(estado.nivelAtual) }]}>
                  {estado.nivelAtual}
                </ThemedText>
              </View>
              <View style={styles.flex}>
                <ProgressBar progress={estado.progresso} accessibilityLabel="Progresso da medição" />
              </View>
              <ThemedText style={styles.segundos}>{`${segundos} s`}</ThemedText>
            </View>
          </View>
          <Button label="Cancelar" variant="secondary" icon={icons.fechar} onPress={cancelar} />
        </View>
      );
    }
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
  mostrador: {
    width: '100%',
    aspectRatio: 320 / 184,
  },
  bloco: {
    gap: Spacing.two,
  },
  escuta: {
    gap: Spacing.one,
  },
  tituloEscuta: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 800,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  valorAoVivo: {
    minWidth: 40,
  },
  numero: {
    fontSize: 30,
    lineHeight: 34,
    fontVariant: ['tabular-nums'],
  },
  segundos: {
    minWidth: 28,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 800,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  flex: {
    flex: 1,
  },
  centro: {
    textAlign: 'center',
  },
});
