import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { obterMissao } from '@/mocks/missoes';
import type { FotoMissao } from '@/mocks/tipos';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

const COR_POR_DEFEITO = Colors.accent;

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
            {
              experimental_backgroundImage: `linear-gradient(160deg, ${cor} 0%, ${Colors.accentPressed} 100%)`,
            },
          ]}>
          <Icon
            name={missao?.distintivo.icon ?? icons.camara}
            size={compacta ? 20 : 40}
            color="rgba(255, 255, 255, 0.75)"
          />
          {compacta ? null : (
            <ThemedText style={styles.legenda} numberOfLines={2}>
              {foto.exemplo ? 'Foto de exemplo' : 'Ilustração · foto fora da demo'}
            </ThemedText>
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
    backgroundColor: Colors.accentPressed,
  },
  ilustracao: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
  },
  legenda: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
    textAlign: 'center',
  },
});
