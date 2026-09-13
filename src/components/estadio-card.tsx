import { StyleSheet, View } from 'react-native';

import { FotoEstadio } from '@/components/foto-estadio';
import { Spacing } from '@/constants/theme';
import { formatarNumero } from '@/lib/formatos';
import type { RoofCoverage, Venue } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Etiqueta, type TomEtiqueta } from '@/ui/etiqueta';
import { IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';

const coberturas: Record<RoofCoverage, { label: string; tone: TomEtiqueta }> = {
  total: { label: 'Cobertura total', tone: 'positivo' },
  parcial: { label: 'Cobertura parcial', tone: 'aviso' },
  nenhuma: { label: 'Sem cobertura', tone: 'negativo' },
};

export function EstadioCard({ venue }: { venue: Venue }) {
  const cobertura = coberturas[venue.roofCoverage];

  return (
    <Card style={styles.card}>
      <FotoEstadio venue={venue} />
      <ListRow
        leading={<IconCircle name={icons.estadio} />}
        title={venue.nome}
        subtitle={`${venue.cidade} · ${formatarNumero(venue.capacidade)} lugares`}
      />
      <View style={styles.etiquetas}>
        <Etiqueta icon={icons.cobertura} label={cobertura.label} tone={cobertura.tone} />
        <Etiqueta
          icon={icons.sombra}
          label={venue.hasShade ? 'Com sombra' : 'Sem sombra'}
          tone={venue.hasShade ? 'positivo' : 'neutro'}
        />
        <Etiqueta
          icon={icons.abrigo}
          label={venue.hasShelter ? 'Com abrigo' : 'Sem abrigo'}
          tone={venue.hasShelter ? 'positivo' : 'neutro'}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
