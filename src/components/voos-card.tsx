import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useMunicipalities, useMyHome } from '@/features/profile/hooks/useMyProfile';
import type { Municipality } from '@/features/profile/types';
import { formatarDiaMes } from '@/lib/datas';
import type { Estadia } from '@/lib/dormida';
import { useUserId } from '@/lib/session';
import { AEROPORTOS, aeroportoMaisPerto, linkGoogleFlights, precisaDeVoo } from '@/lib/voos';
import type { Regiao, Venue } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { icons } from '@/ui/icon';
import { Segmentado } from '@/ui/segmentado';
import { ThemedText } from '@/ui/themed-text';

const REGIAO: Record<Municipality['region'], Regiao> = {
  mainland: 'continente',
  madeira: 'madeira',
  azores: 'acores',
};

/**
 * Procurar voos para um jogo do outro lado do mar ou da fronteira: abre o Google Flights com o aeroporto de onde se
 * parte (o mais perto do concelho, se o soubermos), a cidade do estádio e as mesmas datas da dormida. Não aparece em
 * jogos no continente para quem é do continente: aí vai-se de boleia.
 */
export function VoosCard({ estadio, estadia }: { estadio: Venue; estadia: Estadia }) {
  const userId = useUserId();
  const casa = useMyHome(userId);
  const municipios = useMunicipalities(casa.data?.municipalityId != null);
  const concelho = municipios.data?.find((m) => m.id === casa.data?.municipalityId) ?? null;
  const partida = concelho ? { latitude: concelho.latitude, longitude: concelho.longitude } : null;
  const [escolhido, setEscolhido] = useState<string | null>(null);

  if (!precisaDeVoo(estadio.regiao, concelho ? REGIAO[concelho.region] : null)) return null;

  const origem = AEROPORTOS.find((a) => a.codigo === escolhido) ?? aeroportoMaisPerto(partida);
  const link = linkGoogleFlights({ origem, cidade: estadio.cidade, pais: estadio.pais, estadia });

  return (
    <Card style={styles.card}>
      <ThemedText type="eyebrow" themeColor="accentInk">
        Procurar voos
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        {`${estadio.cidade} · ida ${formatarDiaMes(new Date(estadia.checkin))}, volta ${formatarDiaMes(new Date(estadia.checkout))}`}
      </ThemedText>

      <View style={styles.seccao}>
        <ThemedText style={styles.rotulo}>De onde partes</ThemedText>
        <Segmentado
          opcoes={AEROPORTOS.map((aeroporto) => ({ valor: aeroporto.codigo, label: aeroporto.nome }))}
          valor={origem.codigo}
          onChange={setEscolhido}
          deslizante
        />
      </View>

      <Button
        label="Procurar no Google Flights"
        icon={icons.aviao}
        onPress={() => void Linking.openURL(link).catch(() => undefined)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  seccao: {
    gap: Spacing.two,
  },
  rotulo: {
    fontWeight: 700,
  },
});
