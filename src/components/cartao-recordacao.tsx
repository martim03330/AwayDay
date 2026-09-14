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
  const corEstado = foto.verificada ? theme.success : theme.warning;

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
        styles.polaroide,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <FotoRecordacao foto={foto} style={styles.foto} />
      <View style={styles.texto}>
        <View style={styles.titulo}>
          {missao ? <Icon name={missao.distintivo.icon} size={14} color={theme.accentInk} /> : null}
          <ThemedText style={styles.nome} numberOfLines={2}>
            {nome}
          </ThemedText>
        </View>
        <ThemedText style={styles.detalhe} themeColor="textSecondary" numberOfLines={1}>
          {estadio?.nome ?? 'Sem estádio'}
        </ThemedText>
        <ThemedText style={styles.detalhe} themeColor="textSecondary">
          {data}
        </ThemedText>
        <View style={styles.estado}>
          <Icon
            name={foto.verificada ? icons.visitado : icons.porVerificar}
            size={14}
            color={corEstado}
          />
          <ThemedText style={[styles.estadoTexto, { color: corEstado }]}>
            {foto.verificada ? 'Verificada' : 'Por verificar'}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  polaroide: {
    padding: Spacing.two,
    paddingBottom: 12,
    borderRadius: 6,
    boxShadow: '0 6px 16px rgba(19, 36, 27, 0.12)',
  },
  foto: {
    aspectRatio: 1,
    borderRadius: 3,
  },
  texto: {
    gap: Spacing.half,
    paddingTop: Spacing.two,
  },
  titulo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one,
  },
  nome: {
    flex: 1,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: 800,
  },
  detalhe: {
    fontSize: 12,
    lineHeight: 16,
  },
  estado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.half,
  },
  estadoTexto: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 800,
  },
  pressed: {
    opacity: 0.7,
  },
});
