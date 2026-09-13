import { StyleSheet, View } from 'react-native';

import { FotoRecordacao } from '@/components/foto-recordacao';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ordenarFotos } from '@/lib/album';
import { plural } from '@/lib/formatos';
import type { FotoMissao } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';

const MINIATURAS = 4;

type AlbumResumoProps = {
  fotos: readonly FotoMissao[];
  onAbrir: () => void;
};

/** Entrada do álbum no perfil: as fotos mais recentes e quantas estão verificadas. */
export function AlbumResumo({ fotos, onAbrir }: AlbumResumoProps) {
  const theme = useTheme();
  const recentes = ordenarFotos(fotos).slice(0, MINIATURAS);
  const verificadas = fotos.filter((foto) => foto.verificada).length;

  return (
    <Card
      onPress={onAbrir}
      accessibilityLabel={`Álbum de recordações: ${plural(fotos.length, 'foto', 'fotos')}, ${verificadas} verificadas. Toca para abrir.`}>
      {recentes.length > 0 ? (
        <View style={styles.miniaturas}>
          {recentes.map((foto) => (
            <FotoRecordacao key={foto.id} foto={foto} compacta style={styles.miniatura} />
          ))}
        </View>
      ) : null}
      <ListRow
        leading={<IconCircle name={icons.album} />}
        title={fotos.length > 0 ? plural(fotos.length, 'recordação', 'recordações') : 'Álbum ainda vazio'}
        subtitle={
          fotos.length > 0
            ? `${plural(verificadas, 'verificada', 'verificadas')} · as fotos das tuas missões`
            : 'Cada missão cumprida fecha com uma foto, que fica aqui guardada.'
        }
        trailing={<Icon name={icons.seguinte} size={16} color={theme.textSecondary} />}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  miniaturas: {
    flexDirection: 'row',
    columnGap: Spacing.two,
  },
  miniatura: {
    width: '22%',
    aspectRatio: 1,
  },
});
