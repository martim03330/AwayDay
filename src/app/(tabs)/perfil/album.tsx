import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CartaoRecordacao } from '@/components/cartao-recordacao';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ordenarFotos } from '@/lib/album';
import { plural } from '@/lib/formatos';
import { useAppState } from '@/state/app-state';
import { EmptyState } from '@/ui/empty-state';
import { Icon, icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { ThemedText } from '@/ui/themed-text';

export default function AlbumScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { fotosMissoes } = useAppState();
  const fotos = ordenarFotos(fotosMissoes);
  const verificadas = fotos.filter((foto) => foto.verificada).length;

  return (
    <Screen>
      {fotos.length === 0 ? (
        <EmptyState
          icon={icons.album}
          title="Álbum vazio, por agora"
          message="Cumpre uma missão e tira a foto de prova: fica aqui para mais tarde."
          action={{ label: 'Ver missões', onPress: () => router.navigate('/ranking/missoes') }}
        />
      ) : (
        <>
          <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.contagem}>
            {`${plural(fotos.length, 'recordação', 'recordações')} · ${plural(verificadas, 'verificada', 'verificadas')}`}
          </ThemedText>
          <View style={styles.grelha}>
            {fotos.map((foto) => (
              <View key={foto.id} style={styles.celula}>
                <CartaoRecordacao
                  foto={foto}
                  onPress={() => router.push({ pathname: '/perfil/foto', params: { fotoId: foto.id } })}
                />
              </View>
            ))}
          </View>
        </>
      )}

      <View style={[styles.nota, { borderColor: theme.borderStrong }]}>
        <Icon name={icons.visitado} size={18} color={theme.accentInk} />
        <ThemedText themeColor="textSecondary" style={styles.notaTexto}>
          Uma foto só fica verificada se for tirada em dia de jogo, com check-in feito perto do estádio.
          Na demo o álbum vive em memória: fechas a app e volta ao início.
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contagem: {
    paddingHorizontal: Spacing.one,
  },
  grelha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.three,
  },
  celula: {
    width: '48%',
  },
  nota: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.two,
    padding: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Spacing.three,
  },
  notaTexto: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
