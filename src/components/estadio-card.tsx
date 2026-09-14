import { StyleSheet, View } from 'react-native';

import { FotoEstadio } from '@/components/foto-estadio';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarNota, formatarNumero, plural } from '@/lib/formatos';
import type { RoofCoverage, Venue } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Etiqueta, type TomEtiqueta } from '@/ui/etiqueta';
import { Icon, icons } from '@/ui/icon';
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
      <View style={styles.corpo}>
        <View style={styles.cabecalho}>
          <View style={styles.titulo}>
            <ThemedText style={styles.nome}>{venue.nome}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {`${venue.cidade}${venue.pais === 'Portugal' ? '' : `, ${venue.pais}`} · ${formatarNumero(venue.capacidade)} lugares`}
            </ThemedText>
          </View>
          {nota ? (
            <View
              style={styles.nota}
              accessible
              accessibilityLabel={`A tua nota: ${formatarNota(nota.media)} de 5, média de ${plural(nota.visitas, 'visita', 'visitas')}`}>
              <View style={styles.notaValor}>
                <Icon name={icons.estrela} size={16} color={theme.highlight} />
                <ThemedText style={styles.notaTexto}>{formatarNota(nota.media)}</ThemedText>
              </View>
              <ThemedText themeColor="textSecondary" style={styles.visitas}>
                {plural(nota.visitas, 'visita', 'visitas')}
              </ThemedText>
            </View>
          ) : null}
        </View>
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
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 0,
    padding: 0,
    overflow: 'hidden',
  },
  corpo: {
    gap: 12,
    padding: Spacing.three,
  },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  titulo: {
    flex: 1,
    gap: Spacing.half,
  },
  nome: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: 800,
  },
  nota: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  notaValor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  notaTexto: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 800,
  },
  visitas: {
    fontSize: 12,
    lineHeight: 16,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
