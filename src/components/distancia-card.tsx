import { StyleSheet } from 'react-native';

import { distanciaEmLinhaRetaKm, estimarViagemDeCarro } from '@/lib/distancia';
import { formatarDuracao, formatarKm } from '@/lib/formatos';
import type { Venue } from '@/mocks/tipos';
import { localizacaoUtilizador } from '@/mocks/utilizador';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';
import { ThemedText } from '@/ui/themed-text';

function ondeFica(venue: Venue) {
  if (venue.regiao === 'madeira') return 'na Madeira';
  if (venue.regiao === 'acores') return 'nos Açores';
  return `em ${venue.pais}`;
}

export function DistanciaCard({ venue }: { venue: Venue }) {
  const { coordenadas, descricao, regiao } = localizacaoUtilizador;
  const deCarro = venue.regiao === regiao;

  const titulo = deCarro
    ? (() => {
        const viagem = estimarViagemDeCarro(coordenadas, venue.coordenadas);
        return `≈ ${formatarKm(viagem.km)} · ${formatarDuracao(viagem.minutos)} de carro`;
      })()
    : `≈ ${formatarKm(distanciaEmLinhaRetaKm(coordenadas, venue.coordenadas))} em linha reta`;

  const subtitulo = deCarro
    ? `A partir de ${descricao} (localização simulada)`
    : `O estádio fica ${ondeFica(venue)}: aqui só mostramos a distância em linha reta a partir de ${descricao}.`;

  return (
    <Card>
      <ListRow
        leading={<IconCircle name={deCarro ? icons.carro : icons.aviao} tone="sky" />}
        title={titulo}
        subtitle={subtitulo}
      />
      <Button label="Ver rota" icon={icons.rota} variant="secondary" disabled onPress={() => {}} />
      <ThemedText themeColor="textMuted" style={styles.nota}>
        Em breve · estimativa sem trânsito
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  nota: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
