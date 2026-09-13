import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { obterMissao } from '@/mocks/missoes';
import type { FotoMissao } from '@/mocks/tipos';

const COR_POR_DEFEITO = '#0B7A43';

type FotoRecordacaoProps = {
  foto: FotoMissao;
  style?: StyleProp<ViewStyle>;
  /** Miniatura: só o distintivo, sem legenda. */
  compacta?: boolean;
};

/** A foto de prova ou, sem ficheiro, uma ilustração com as cores do clube da casa e o distintivo. */
export function FotoRecordacao({ foto, style, compacta = false }: FotoRecordacaoProps) {
  const missao = obterMissao(foto.missaoId);
  const estadio = foto.estadioId ? obterEstadio(foto.estadioId) : undefined;
  const cor = (estadio ? obterClube(estadio.clubeId)?.cores.primaria : undefined) ?? COR_POR_DEFEITO;
  const descricao = `Foto da missão ${missao?.titulo ?? ''}`.trim();

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={foto.uri ? descricao : `${descricao}, ilustração`}
      style={[styles.base, style]}>
      {foto.uri ? (
        <Image source={{ uri: foto.uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.ilustracao,
            { experimental_backgroundImage: `linear-gradient(160deg, ${cor} 0%, #0B0B0B 100%)` },
          ]}>
          <Text style={compacta ? styles.emojiPequeno : styles.emoji}>
            {missao?.distintivo.emoji ?? '📷'}
          </Text>
          {compacta ? null : (
            <Text style={styles.legenda} numberOfLines={2}>
              {foto.exemplo ? 'Foto de exemplo' : 'Ilustração · foto fora da demo'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  ilustracao: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 8,
  },
  emoji: {
    fontSize: 44,
    lineHeight: 54,
  },
  emojiPequeno: {
    fontSize: 22,
    lineHeight: 28,
  },
  legenda: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});
