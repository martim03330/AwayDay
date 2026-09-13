import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  acumularBlocos,
  analisarMedicao,
  DURACAO_MEDICAO_MS,
  nivelNaEscala,
  type BlocoSom,
  type MotivoMedicaoInvalida,
} from '@/lib/barulhometro';

export type EstadoMedidor =
  | { tipo: 'parado' }
  | { tipo: 'a-medir'; progresso: number; nivelAtual: number }
  | { tipo: 'invalida'; motivo: MotivoMedicaoInvalida }
  | { tipo: 'sem-permissao'; podePedirOutraVez: boolean }
  | { tipo: 'erro' };

type Sessao = {
  ativa: boolean;
  blocos: BlocoSom[];
  /** Amostras que ainda não chegam a um bloco de 100 ms. */
  resto: Float32Array;
  temporizador: ReturnType<typeof setTimeout> | null;
};

/** Volta a sessão de áudio ao modo de reprodução, para os sons da app continuarem a tocar. */
function reporSessaoDeAudio() {
  void setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: false,
    interruptionMode: 'mixWithOthers',
  });
}

/**
 * Mede o barulho a partir do stream do microfone. As amostras são analisadas em memória e
 * deitadas fora no fim: não se cria nenhum ficheiro de áudio.
 */
export function useBarulhometro(onMedicaoValida: (nivel: number) => void) {
  const [estado, setEstado] = useState<EstadoMedidor>({ tipo: 'parado' });
  const sessao = useRef<Sessao>({
    ativa: false,
    blocos: [],
    resto: new Float32Array(0),
    temporizador: null,
  });

  const { stream } = useAudioStream({
    sampleRate: 16_000,
    channels: 1,
    encoding: 'float32',
    onBuffer: (buffer) => {
      const atual = sessao.current;
      if (!atual.ativa) return;
      const { blocos: novos, resto } = acumularBlocos(
        atual.resto,
        new Float32Array(buffer.data),
        buffer.sampleRate * buffer.channels
      );
      atual.resto = resto;
      atual.blocos.push(...novos);
      const duracao = atual.blocos.reduce((soma, bloco) => soma + bloco.duracaoMs, 0);
      const ultimo = novos.at(-1);
      setEstado({
        tipo: 'a-medir',
        progresso: Math.min(1, duracao / DURACAO_MEDICAO_MS),
        nivelAtual: ultimo ? nivelNaEscala(ultimo.nivelDb) : 0,
      });
    },
  });

  useEffect(() => {
    const atual = sessao.current;
    return () => {
      if (atual.temporizador) clearTimeout(atual.temporizador);
      if (!atual.ativa) return;
      atual.ativa = false;
      atual.blocos = [];
      atual.resto = new Float32Array(0);
      try {
        stream.stop();
      } catch {
        // O stream pode já ter sido libertado ao sair do ecrã.
      }
      reporSessaoDeAudio();
    };
  }, [stream]);

  function terminar() {
    const atual = sessao.current;
    if (!atual.ativa) return;
    atual.ativa = false;
    atual.temporizador = null;
    stream.stop();
    reporSessaoDeAudio();

    const resultado = analisarMedicao(atual.blocos);
    // As amostras só serviram para calcular o nível: não ficam em lado nenhum.
    atual.blocos = [];
    atual.resto = new Float32Array(0);
    if (resultado.valida) {
      setEstado({ tipo: 'parado' });
      onMedicaoValida(resultado.nivel);
    } else {
      setEstado({ tipo: 'invalida', motivo: resultado.motivo });
    }
  }

  async function comecar() {
    const atual = sessao.current;
    if (atual.ativa) return;

    const permissao = await requestRecordingPermissionsAsync();
    if (!permissao.granted) {
      setEstado({ tipo: 'sem-permissao', podePedirOutraVez: permissao.canAskAgain });
      return;
    }

    atual.blocos = [];
    atual.resto = new Float32Array(0);
    atual.ativa = true;
    setEstado({ tipo: 'a-medir', progresso: 0, nivelAtual: 0 });
    try {
      await stream.start();
    } catch {
      atual.ativa = false;
      reporSessaoDeAudio();
      setEstado({ tipo: 'erro' });
      return;
    }
    atual.temporizador = setTimeout(terminar, DURACAO_MEDICAO_MS);
  }

  /** Antes do primeiro pedido de permissão, explica para que serve o microfone. */
  async function medir() {
    const permissao = await getRecordingPermissionsAsync();
    if (permissao.granted) {
      await comecar();
      return;
    }
    Alert.alert(
      'Barulhómetro',
      'Vamos ouvir a bancada durante 10 segundos. Não gravamos nada: só calculamos o nível do som.',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Continuar', onPress: () => void comecar() },
      ]
    );
  }

  function cancelar() {
    const atual = sessao.current;
    if (atual.temporizador) clearTimeout(atual.temporizador);
    atual.temporizador = null;
    atual.blocos = [];
    atual.resto = new Float32Array(0);
    if (atual.ativa) {
      atual.ativa = false;
      stream.stop();
      reporSessaoDeAudio();
    }
    setEstado({ tipo: 'parado' });
  }

  return { estado, medir, cancelar };
}
