import { Pressable, StyleSheet, View } from 'react-native';

import { FotoRecordacao } from '@/components/foto-recordacao';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarData } from '@/lib/datas';
import { obterEstadio } from '@/mocks/estadios';
import { obterMissao } from '@/mocks/missoes';
import type { FotoMissao } from '@/mocks/tipos';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type CartaoRecordacaoProps = {
  foto: FotoMissao;
  onPress: () => void;
};

/** Uma recordação na grelha do álbum: foto, distintivo, estádio e data. */
export function CartaoRecordacao({ foto, onPress }: CartaoRecordacaoProps) {
  const theme = useTheme();
  const missao = obterMissao(foto.missaoId);
  const estadio = foto.estadioId ? obterEstadio(foto.estadioId) : undefined;
  const data = formatarData(new Date(foto.tiradaEm));
  const nome = missao ? missao.distintivo.nome : 'Recordação';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        nome,
        estadio?.nome ?? null,
        data,
        foto.verificada ? 'verificada' : 'por verificar',
      ]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [
        styles.cartao,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <FotoRecordacao foto={foto} style={styles.foto} />
      <View style={styles.texto}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {missao ? `${missao.distintivo.emoji} ${nome}` : nome}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {estadio?.nome ?? 'Sem estádio'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {data}
        </ThemedText>
        <View style={styles.estado}>
          <Icon
            name={foto.verificada ? icons.visitado : icons.porVerificar}
            size={14}
            color={foto.verificada ? theme.success : theme.warning}
          />
          <ThemedText
            type="smallBold"
            style={[styles.estadoTexto, { color: foto.verificada ? theme.success : theme.warning }]}>
            {foto.verificada ? 'Verificada' : 'Por verificar'}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cartao: {
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  foto: {
    aspectRatio: 1,
    borderRadius: 0,
  },
  texto: {
    gap: Spacing.half,
    padding: Spacing.two,
  },
  estado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.half,
  },
  estadoTexto: {
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.7,
  },
});
