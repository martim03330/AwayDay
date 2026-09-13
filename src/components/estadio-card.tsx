import { StyleSheet, View } from 'react-native';

import { FotoEstadio } from '@/components/foto-estadio';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarNota, formatarNumero, plural } from '@/lib/formatos';
import type { RoofCoverage, Venue } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Etiqueta, type TomEtiqueta } from '@/ui/etiqueta';
import { IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';
import { ThemedText } from '@/ui/themed-text';

const coberturas: Record<RoofCoverage, { label: string; tone: TomEtiqueta }> = {
  total: { label: 'Cobertura total', tone: 'positivo' },
  parcial: { label: 'Cobertura parcial', tone: 'aviso' },
  nenhuma: { label: 'Sem cobertura', tone: 'negativo' },
};

type EstadioCardProps = {
  venue: Venue;
  /** A tua nota do estádio: média das visitas avaliadas. */
  nota: { media: number; visitas: number } | null;
};

export function EstadioCard({ venue, nota }: EstadioCardProps) {
  const theme = useTheme();
  const cobertura = coberturas[venue.roofCoverage];

  return (
    <Card style={styles.card}>
      <FotoEstadio venue={venue} />
      <ListRow
        leading={<IconCircle name={icons.estadio} />}
        title={venue.nome}
        subtitle={`${venue.cidade}${venue.pais === 'Portugal' ? '' : `, ${venue.pais}`} · ${formatarNumero(venue.capacidade)} lugares`}
        trailing={
          nota ? (
            <View style={styles.nota} accessible accessibilityLabel={`A tua nota: ${formatarNota(nota.media)} de 5, média de ${plural(nota.visitas, 'visita', 'visitas')}`}>
              <ThemedText style={[styles.notaValor, { color: theme.accent }]}>
                ★ {formatarNota(nota.media)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {plural(nota.visitas, 'visita', 'visitas')}
              </ThemedText>
            </View>
          ) : null
        }
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
  nota: {
    alignItems: 'flex-end',
  },
  notaValor: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
