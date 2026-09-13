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

const nomesIlha = {
  madeira: 'na Madeira',
  acores: 'nos Açores',
  continente: 'no continente',
} as const;

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
    : `O estádio fica ${nomesIlha[venue.regiao]}: não há percurso de carro a partir de ${descricao}.`;

  return (
    <Card>
      <ListRow
        leading={<IconCircle name={deCarro ? icons.carro : icons.aviao} />}
        title={titulo}
        subtitle={subtitulo}
      />
      <Button label="Ver rota" icon={icons.rota} variant="secondary" disabled onPress={() => {}} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.nota}>
        Em breve · estimativa sem trânsito
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  nota: {
    textAlign: 'center',
  },
});
