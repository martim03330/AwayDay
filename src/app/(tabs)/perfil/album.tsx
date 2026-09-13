import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CartaoRecordacao } from '@/components/cartao-recordacao';
import { Spacing } from '@/constants/theme';
import { ordenarFotos } from '@/lib/album';
import { plural } from '@/lib/formatos';
import { useAppState } from '@/state/app-state';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { ThemedText } from '@/ui/themed-text';

export default function AlbumScreen() {
  const router = useRouter();
  const { fotosMissoes } = useAppState();
  const fotos = ordenarFotos(fotosMissoes);
  const verificadas = fotos.filter((foto) => foto.verificada).length;

  return (
    <Screen>
      {fotos.length === 0 ? (
        <Card>
          <EmptyState
            icon={icons.album}
            title="Álbum vazio, por agora"
            message="Cumpre uma missão e tira a foto de prova: fica aqui para mais tarde."
            action={{ label: 'Ver missões', onPress: () => router.back() }}
          />
        </Card>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
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

      <ThemedText type="small" themeColor="textSecondary">
        Uma foto só fica verificada se for tirada em dia de jogo, com check-in feito perto do estádio.
        Na demo o álbum vive em memória: fechas a app e volta ao início.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grelha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.three,
  },
  celula: {
    width: '48.5%',
  },
});
